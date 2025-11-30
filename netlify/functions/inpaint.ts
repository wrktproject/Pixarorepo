/**
 * Inpainting API Endpoint (Netlify Function)
 * 
 * Proxies requests to Replicate with:
 * - Rate limiting (5 free uses per day per IP)
 * - API key kept secret on server
 * - Graceful error handling
 * 
 * Uses stability-ai/stable-diffusion-inpainting model
 */

import type { Context } from "@netlify/functions";

// Simple in-memory rate limiting (resets on cold start)
const usageMap = new Map<string, { count: number; resetTime: number }>();

const DAILY_LIMIT = 5;
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';

// stable-diffusion-inpainting: Latest version with SD 2.0 and AITemplate acceleration
// https://replicate.com/stability-ai/stable-diffusion-inpainting
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

async function pollForResult(
  predictionId: string,
  apiKey: string,
  maxWaitSeconds: number = 90
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Poll error:', response.status, errorText);
      throw new Error(`Failed to check prediction: ${response.status}`);
    }
    
    const prediction = await response.json();
    console.log('Prediction status:', prediction.status);
    
    if (prediction.status === 'succeeded') {
      return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    }
    
    if (prediction.status === 'failed') {
      console.error('Prediction failed:', prediction.error, prediction.logs?.substring(0, 500));
      throw new Error(`AI model failed: ${prediction.error || 'Unknown error'}`);
    }
    
    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  throw new Error('Prediction timed out after 90 seconds');
}

export default async function handler(request: Request, _context: Context): Promise<Response> {
  console.log('Inpaint function called:', request.method, request.url);
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'rate_limit',
      message: `Daily limit reached. Resets in ${rateLimit.resetIn} minutes.`,
      remaining: 0,
      resetIn: rateLimit.resetIn,
    }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const apiKey = process.env.REPLICATE_API_KEY;
  
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey?.length || 0);
  console.log('API Key prefix:', apiKey?.substring(0, 5) || 'none');
  
  if (!apiKey) {
    console.error('REPLICATE_API_KEY not configured');
    return new Response(JSON.stringify({
      error: 'config_error',
      message: 'Server not configured. Using local processing.',
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    let body: InpaintRequest;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!body.image || !body.mask) {
      console.error('Missing image or mask in request');
      return new Response(JSON.stringify({ error: 'Missing image or mask' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Creating prediction with model version:', INPAINT_MODEL_VERSION.substring(0, 12) + '...');
    console.log('Image size:', body.image.length, 'Mask size:', body.mask.length);
    
    // Create prediction with SD Inpainting model
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
          prompt: 'clean natural background, seamless blend, photorealistic texture, high quality',
          negative_prompt: 'blur, artifacts, distortion, text, watermark, unnatural, obvious editing, low quality',
          num_inference_steps: 25,
          guidance_scale: 7.5,
          disable_safety_checker: true,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Replicate create error:', createResponse.status, errorText);
      
      let errorMessage = 'AI service error';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorMessage;
      } catch {
        // Use default
      }
      
      return new Response(JSON.stringify({
        error: 'api_error',
        message: errorMessage,
        details: `Status: ${createResponse.status}`,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const prediction = await createResponse.json();
    console.log('Prediction created:', prediction.id);
    
    const resultUrl = await pollForResult(prediction.id, apiKey);
    
    if (!resultUrl) {
      throw new Error('No result from model');
    }
    
    console.log('Prediction succeeded, result URL received');
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
    console.error('Inpainting error:', errorMessage);
    
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

