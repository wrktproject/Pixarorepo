/**
 * Depth Estimation API Endpoint (Netlify Function)
 * Uses MiDaS depth estimation model via Replicate
 * Returns a high-quality depth map for lens blur effects
 */

const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// MiDaS model - robust monocular depth estimation (cjwbw/midas)
const MIDAS_MODEL_VERSION = 'a6ba5798f04f80d3b314de0f0a62277f21ab3503c60c84d4817de83c5edfdae0';

async function pollForResult(predictionId, apiKey) {
  const maxWaitMs = 60000; // 60 seconds for depth estimation
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`${REPLICATE_API_URL}/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check prediction: ${response.status}`);
    }
    
    const prediction = await response.json();
    console.log('Depth prediction status:', prediction.status);
    
    if (prediction.status === 'succeeded') {
      return prediction.output;
    }
    
    if (prediction.status === 'failed') {
      throw new Error(`Depth model failed: ${prediction.error || 'Unknown error'}`);
    }
    
    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Depth estimation timed out');
}

export default async (request) => {
  console.log('=== DEPTH FUNCTION CALLED ===');
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
  
  // Check API key
  const apiKey = Netlify.env.get('REPLICATE_API_KEY');
  console.log('API Key configured:', !!apiKey);
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'config_error',
      message: 'Server not configured for depth estimation.',
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // Parse request body
    const body = await request.json();
    
    if (!body.image) {
      return new Response(JSON.stringify({ error: 'Missing image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Image size:', body.image.length);
    
    // Create prediction using MiDaS model
    const createResponse = await fetch(REPLICATE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: MIDAS_MODEL_VERSION,
        input: {
          image: body.image,
          model_type: 'dpt_beit_large_512', // Best quality - valid options: dpt_beit_large_512, dpt_swin2_large_384, dpt_swin2_tiny_256, dpt_levit_224
        },
      }),
    });
    
    console.log('Replicate response status:', createResponse.status);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Replicate error:', errorText);
      return new Response(JSON.stringify({
        error: 'api_error',
        message: 'Depth estimation service error',
        details: errorText,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const prediction = await createResponse.json();
    console.log('Prediction created:', prediction.id);
    
    // Poll for result
    const depthMapUrl = await pollForResult(prediction.id, apiKey);
    
    if (!depthMapUrl) {
      throw new Error('No result from depth model');
    }
    
    console.log('Success! Depth map URL received');
    
    return new Response(JSON.stringify({
      success: true,
      depthMapUrl: depthMapUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Depth estimation failed';
    console.error('Error:', errorMessage);
    
    return new Response(JSON.stringify({
      error: 'processing_error',
      message: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: "/api/depth"
};
