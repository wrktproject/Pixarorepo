/**
 * Depth Estimation API Endpoint (Netlify Function)
 * Uses MiDaS depth estimation model via Replicate
 * Returns a high-quality depth map for lens blur effects
 */

const REPLICATE_API_URL = 'https://api.replicate.com/v1/predictions';
// MiDaS model - robust monocular depth estimation (cjwbw/midas)
const MIDAS_MODEL_VERSION = 'a6ba5798f04f80d3b314de0f0a62277f21ab3503c60c84d4817de83c5edfdae0';

async function pollForResult(predictionId, apiKey, maxWaitMs = 50000) {
  const startTime = Date.now();
  let coldStartWarned = false;
  
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
      return { success: true, output: prediction.output };
    }
    
    if (prediction.status === 'failed') {
      throw new Error(`Depth model failed: ${prediction.error || 'Unknown error'}`);
    }
    
    if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }
    
    // If still starting after 15 seconds, it's a cold start - warn the client
    if (prediction.status === 'starting' && Date.now() - startTime > 15000 && !coldStartWarned) {
      coldStartWarned = true;
      console.log('Model is cold starting, may take longer...');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Timeout - return the prediction ID so client can retry
  return { success: false, predictionId, message: 'Still processing, try again' };
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
    
    // Check if this is a status check for an existing prediction
    if (body.predictionId) {
      console.log('Checking existing prediction:', body.predictionId);
      const result = await pollForResult(body.predictionId, apiKey, 25000);
      
      if (result.success) {
        return new Response(JSON.stringify({
          success: true,
          depthMapUrl: result.output,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          predictionId: result.predictionId,
          message: result.message,
        }), {
          status: 202, // Accepted but still processing
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    if (!body.image) {
      return new Response(JSON.stringify({ error: 'Missing image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Image size:', body.image.length);
    
    // Use a smaller, faster model for quicker cold starts
    // dpt_swin2_tiny_256 is much faster while still producing good results
    const modelType = body.quality === 'high' ? 'dpt_beit_large_512' : 'dpt_swin2_tiny_256';
    console.log('Using model type:', modelType);
    
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
          model_type: modelType,
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
    
    // Poll for result with reduced timeout to avoid gateway timeout
    const result = await pollForResult(prediction.id, apiKey, 50000);
    
    if (result.success) {
      console.log('Success! Depth map URL received');
      return new Response(JSON.stringify({
        success: true,
        depthMapUrl: result.output,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Return prediction ID so client can retry
      console.log('Prediction still processing, returning ID for retry');
      return new Response(JSON.stringify({
        success: false,
        predictionId: prediction.id,
        message: 'Model is still warming up. Please retry in a few seconds.',
      }), {
        status: 202, // Accepted but still processing
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
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
