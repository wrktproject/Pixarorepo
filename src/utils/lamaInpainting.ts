/**
 * LaMa (Large Mask Inpainting) using ONNX Runtime Web
 * 
 * This provides AI-powered content-aware fill using a pre-trained neural network.
 * Falls back to PatchMatch if the model is unavailable or fails.
 */

import * as ort from 'onnxruntime-web';

// Model configuration
const MODEL_URL = '/models/model_fp16.onnx';
const MODEL_SIZE = 512; // LaMa works at 512x512
const INFERENCE_TIMEOUT = 30000; // 30 second timeout

let session: ort.InferenceSession | null = null;
let sessionLoading: Promise<ort.InferenceSession | null> | null = null;
let modelAvailable = true;
let modelTested = false;

/**
 * Initialize ONNX Runtime and load the LaMa model
 */
async function initSession(): Promise<ort.InferenceSession | null> {
  if (session) return session;
  if (sessionLoading) return sessionLoading;
  
  sessionLoading = (async () => {
    try {
      // Configure ONNX Runtime to use CDN for WASM files
      const ortVersion = '1.23.2';
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ortVersion}/dist/`;
      
      // Disable multi-threading to avoid issues
      ort.env.wasm.numThreads = 1;
      
      console.log('Loading LaMa model...');
      
      session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      
      console.log('LaMa model loaded successfully');
      console.log('Model inputs:', session.inputNames);
      console.log('Model outputs:', session.outputNames);
      
      return session;
    } catch (error) {
      console.warn('Failed to load LaMa model, falling back to PatchMatch:', error);
      modelAvailable = false;
      return null;
    }
  })();
  
  return sessionLoading;
}

/**
 * Check if LaMa model is available
 */
export function isLamaAvailable(): boolean {
  return modelAvailable && !modelTested; // Only try once if it failed
}

/**
 * Preload the model (call on app start)
 */
export async function preloadLamaModel(): Promise<boolean> {
  const sess = await initSession();
  return sess !== null;
}

/**
 * Run inference with timeout
 */
async function runInferenceWithTimeout(
  sess: ort.InferenceSession,
  feeds: Record<string, ort.Tensor>,
  timeoutMs: number
): Promise<ort.InferenceSession.OnnxValueMapType> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Inference timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    sess.run(feeds)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Run LaMa inpainting on an image region
 */
export async function runLamaInpainting(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): Promise<ImageData | null> {
  const sess = await initSession();
  if (!sess) {
    console.log('LaMa not available, skipping');
    return null;
  }
  
  const { width, height, data } = imageData;
  const startTime = performance.now();
  
  try {
    // Expand bounds with padding for context
    const padding = 30;
    const workBounds = {
      minX: Math.max(0, bounds.minX - padding),
      minY: Math.max(0, bounds.minY - padding),
      maxX: Math.min(width - 1, bounds.maxX + padding),
      maxY: Math.min(height - 1, bounds.maxY + padding),
    };
    
    const regionWidth = workBounds.maxX - workBounds.minX + 1;
    const regionHeight = workBounds.maxY - workBounds.minY + 1;
    
    // Calculate scale to fit the larger dimension to MODEL_SIZE
    const maxDim = Math.max(regionWidth, regionHeight);
    const scale = MODEL_SIZE / maxDim;
    
    console.log('LaMa inpainting:', {
      region: `${regionWidth}x${regionHeight}`,
      scale: scale.toFixed(3),
      modelSize: MODEL_SIZE
    });
    
    // Create input tensors (always 512x512)
    const imgTensor = new Float32Array(1 * 3 * MODEL_SIZE * MODEL_SIZE);
    const maskTensor = new Float32Array(1 * 1 * MODEL_SIZE * MODEL_SIZE);
    
    // Fill with zeros (padding)
    imgTensor.fill(0);
    maskTensor.fill(0);
    
    // Calculate centering offset
    const scaledWidth = Math.round(regionWidth * scale);
    const scaledHeight = Math.round(regionHeight * scale);
    const offsetX = Math.floor((MODEL_SIZE - scaledWidth) / 2);
    const offsetY = Math.floor((MODEL_SIZE - scaledHeight) / 2);
    
    // Fill tensor with scaled image data
    for (let dy = 0; dy < scaledHeight; dy++) {
      for (let dx = 0; dx < scaledWidth; dx++) {
        // Map to original image coordinates
        const srcX = Math.floor(dx / scale) + workBounds.minX;
        const srcY = Math.floor(dy / scale) + workBounds.minY;
        
        if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) continue;
        
        const tensorX = dx + offsetX;
        const tensorY = dy + offsetY;
        
        if (tensorX < 0 || tensorX >= MODEL_SIZE || tensorY < 0 || tensorY >= MODEL_SIZE) continue;
        
        const srcIdx = (srcY * width + srcX) * 4;
        const tensorIdx = tensorY * MODEL_SIZE + tensorX;
        
        // RGB channels in CHW format, normalized to [0, 1]
        imgTensor[tensorIdx] = data[srcIdx] / 255;
        imgTensor[MODEL_SIZE * MODEL_SIZE + tensorIdx] = data[srcIdx + 1] / 255;
        imgTensor[2 * MODEL_SIZE * MODEL_SIZE + tensorIdx] = data[srcIdx + 2] / 255;
        
        // Mask: 1 = inpaint, 0 = keep
        maskTensor[tensorIdx] = mask[srcY * width + srcX] > 0.5 ? 1 : 0;
      }
    }
    
    console.log('Running LaMa inference...');
    
    // Build feeds using actual model input names
    const feeds: Record<string, ort.Tensor> = {};
    feeds[sess.inputNames[0]] = new ort.Tensor('float32', imgTensor, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    feeds[sess.inputNames[1]] = new ort.Tensor('float32', maskTensor, [1, 1, MODEL_SIZE, MODEL_SIZE]);
    
    // Run with timeout
    const results = await runInferenceWithTimeout(sess, feeds, INFERENCE_TIMEOUT);
    
    const outputTensor = results[sess.outputNames[0]].data as Float32Array;
    
    console.log(`LaMa inference completed in ${(performance.now() - startTime).toFixed(0)}ms`);
    modelTested = true; // Mark as tested (successfully)
    
    // Create result image
    const resultData = new Uint8ClampedArray(data);
    
    // Map output back to original image coordinates
    for (let dy = 0; dy < scaledHeight; dy++) {
      for (let dx = 0; dx < scaledWidth; dx++) {
        const srcX = Math.floor(dx / scale) + workBounds.minX;
        const srcY = Math.floor(dy / scale) + workBounds.minY;
        
        if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) continue;
        
        const maskVal = mask[srcY * width + srcX];
        if (maskVal < 0.1) continue;
        
        const tensorX = dx + offsetX;
        const tensorY = dy + offsetY;
        
        if (tensorX < 0 || tensorX >= MODEL_SIZE || tensorY < 0 || tensorY >= MODEL_SIZE) continue;
        
        const tensorIdx = tensorY * MODEL_SIZE + tensorX;
        const dstIdx = (srcY * width + srcX) * 4;
        
        // Extract RGB from CHW output
        const r = Math.round(Math.max(0, Math.min(1, outputTensor[tensorIdx])) * 255);
        const g = Math.round(Math.max(0, Math.min(1, outputTensor[MODEL_SIZE * MODEL_SIZE + tensorIdx])) * 255);
        const b = Math.round(Math.max(0, Math.min(1, outputTensor[2 * MODEL_SIZE * MODEL_SIZE + tensorIdx])) * 255);
        
        // Blend based on mask weight
        const blend = Math.min(1, maskVal);
        resultData[dstIdx] = Math.round(resultData[dstIdx] * (1 - blend) + r * blend);
        resultData[dstIdx + 1] = Math.round(resultData[dstIdx + 1] * (1 - blend) + g * blend);
        resultData[dstIdx + 2] = Math.round(resultData[dstIdx + 2] * (1 - blend) + b * blend);
      }
    }
    
    // Apply edge smoothing
    smoothEdges(resultData, mask, width, bounds);
    
    return new ImageData(resultData, width, height);
    
  } catch (error) {
    console.error('LaMa inference failed:', error);
    modelTested = true;
    modelAvailable = false; // Don't try again
    return null;
  }
}

/**
 * Smooth edges where inpainted region meets original
 */
function smoothEdges(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const temp = new Uint8ClampedArray(data);
  const radius = 3;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      const maskVal = mask[idx];
      
      // Only smooth edge pixels
      if (maskVal < 0.1 || maskVal > 0.9) continue;
      
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < bounds.minY || ny > bounds.maxY) continue;
          
          const nIdx = (ny * width + nx) * 4;
          sumR += temp[nIdx];
          sumG += temp[nIdx + 1];
          sumB += temp[nIdx + 2];
          count++;
        }
      }
      
      if (count > 0) {
        const pixelIdx = idx * 4;
        const blend = 0.5;
        data[pixelIdx] = Math.round(temp[pixelIdx] * (1 - blend) + (sumR / count) * blend);
        data[pixelIdx + 1] = Math.round(temp[pixelIdx + 1] * (1 - blend) + (sumG / count) * blend);
        data[pixelIdx + 2] = Math.round(temp[pixelIdx + 2] * (1 - blend) + (sumB / count) * blend);
      }
    }
  }
}
