/**
 * Inpainting API Endpoint (Netlify Function)
 * Uses stability-ai/stable-diffusion-inpainting model via Replicate
 */

// Simple in-memory rate limiting (resets on cold start)
const usageMap = new Map<string, { count: number; resetTime: number }>();

const DAILY_LIMIT = 5;
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
const INPAINT_MODEL_VERSION = '95b7223104132402a9ae91cc677285bc5eb997834bd2349fa486f53910fd68b3';

interface InpaintRequest {
  image: string;
  mask: string;
}

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || request.headers.get('client-ip')
    || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  let usage = usageMap.get(ip);
  
  if (!usage || now > usage.resetTime) {
    usage = { count: 0, resetTime: now + dayMs };
    usageMap.set(ip, usage);
  }
  
  const remaining = Math.max(0, DAILY_LIMIT - usage.count);
  const resetIn = Math.max(0, Math.ceil((usage.resetTime - now) / 1000 / 60));
  
  return { allowed: usage.count < DAILY_LIMIT, remaining, resetIn };
}

function incrementUsage(ip: string): void {
  const usage = usageMap.get(ip);
  if (usage) {
    usage.count++;
  }
}

async function pollForResult(predictionId: string, apiKey: string): Promise<string | null> {
  const maxWaitSeconds = 90;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check prediction: ${response.status}`);
    }
    
    const prediction = await response.json();
    console.log('Prediction status:', prediction.status);
    
    if (prediction.status === 'succeeded') {
      return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    }
    
    if (prediction.status === 'failed') {
      throw new Error(`AI model failed: ${prediction.error || 'Unknown error'}`);
    }
    
    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  throw new Error('Prediction timed out');
}

export default async function handler(request: Request): Promise<Response> {
  console.log('=== INPAINT FUNCTION CALLED ===');
  console.log('Method:', request.method);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Rate limiting
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  console.log('Client IP:', clientIP, 'Rate limit:', rateLimit);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'rate_limit',
      message: `Daily limit reached. Resets in ${rateLimit.resetIn} minutes.`,
      remaining: 0,
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Check API key
  const apiKey = process.env.REPLICATE_API_KEY;
  console.log('API Key configured:', !!apiKey);
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'config_error',
      message: 'Server not configured. Using local processing.',
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // Parse request body
    const body: InpaintRequest = await request.json();
    
    if (!body.image || !body.mask) {
      return new Response(JSON.stringify({ error: 'Missing image or mask' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Image size:', body.image.length, 'Mask size:', body.mask.length);
    
    // Create prediction
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: INPAINT_MODEL_VERSION,
        input: {
          image: body.image,
          mask: body.mask,
          prompt: 'clean natural background, seamless blend, photorealistic',
          negative_prompt: 'blur, artifacts, distortion, text, watermark',
          num_inference_steps: 25,
          guidance_scale: 7.5,
        },
      }),
    });
    
    console.log('Replicate response status:', createResponse.status);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Replicate error:', errorText);
      return new Response(JSON.stringify({
        error: 'api_error',
        message: 'AI service error',
        details: errorText,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const prediction = await createResponse.json();
    console.log('Prediction created:', prediction.id);
    
    // Poll for result
    const resultUrl = await pollForResult(prediction.id, apiKey);
    
    if (!resultUrl) {
      throw new Error('No result from model');
    }
    
    console.log('Success! Result URL received');
    incrementUsage(clientIP);
    
    return new Response(JSON.stringify({
      success: true,
      imageUrl: resultUrl,
      remaining: rateLimit.remaining - 1,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing failed';
    console.error('Error:', errorMessage);
    
    return new Response(JSON.stringify({
      error: 'processing_error',
      message: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: "/api/inpaint"
};

