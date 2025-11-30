/**
 * Inpainting API Endpoint
 * 
 * Proxies requests to Replicate with:
 * - Rate limiting (5 free uses per day per IP)
 * - API key kept secret on server
 * - Graceful error handling
 */

// Simple in-memory rate limiting (resets on cold start)
// For production, use Redis/KV store
const usageMap = new Map<string, { count: number; resetTime: number }>();

const DAILY_LIMIT = 5;
const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';

// LaMa (Large Mask Inpainting) model - better for object removal
// This model is specifically designed for removing objects without needing prompts
const LAMA_MODEL_VERSION = 'e3de65e34f8bfcc6933bb7d9f3cbb80d1acc3e6c7a6e6cdfead35cb3da63018a';

interface InpaintRequest {
  image: string;  // base64 data URL
  mask: string;   // base64 data URL
}

function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  let usage = usageMap.get(ip);
  
  // Reset if new day
  if (!usage || now > usage.resetTime) {
    usage = { count: 0, resetTime: now + dayMs };
    usageMap.set(ip, usage);
  }
  
  const remaining = Math.max(0, DAILY_LIMIT - usage.count);
  const resetIn = Math.max(0, Math.ceil((usage.resetTime - now) / 1000 / 60)); // minutes
  
  return {
    allowed: usage.count < DAILY_LIMIT,
    remaining,
    resetIn,
  };
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
  maxWaitSeconds: number = 60
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to check prediction status');
    }
    
    const prediction = await response.json();
    
    if (prediction.status === 'succeeded') {
      const output = Array.isArray(prediction.output) 
        ? prediction.output[0] 
        : prediction.output;
      return output;
    }
    
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Prediction ${prediction.status}`);
    }
    
    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Prediction timed out');
}

export default async function handler(request: Request): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Handle preflight
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
  
  // Check rate limit
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
  
  // Get API key from environment
  const apiKey = process.env.REPLICATE_API_KEY;
  
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
    const body: InpaintRequest = await request.json();
    
    if (!body.image || !body.mask) {
      return new Response(JSON.stringify({ error: 'Missing image or mask' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create prediction using LaMa model
    // LaMa is specifically designed for object removal/inpainting
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: LAMA_MODEL_VERSION,
        input: {
          image: body.image,
          mask: body.mask,
        },
      }),
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Replicate API error:', createResponse.status, errorText);
      
      // Parse error for more specific message
      let errorMessage = 'AI service temporarily unavailable';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.detail) {
          errorMessage = errorJson.detail;
        }
      } catch {
        // Use default message
      }
      
      return new Response(JSON.stringify({
        error: 'api_error',
        message: errorMessage,
        status: createResponse.status,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const prediction = await createResponse.json();
    
    // Poll for result
    const resultUrl = await pollForResult(prediction.id, apiKey);
    
    if (!resultUrl) {
      throw new Error('No result from model');
    }
    
    // Increment usage count on success
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
    console.error('Inpainting error:', error);
    return new Response(JSON.stringify({
      error: 'processing_error',
      message: error instanceof Error ? error.message : 'Processing failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Vercel Edge config
export const config = {
  runtime: 'edge',
};

