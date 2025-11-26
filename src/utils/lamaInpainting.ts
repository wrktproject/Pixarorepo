/**
 * LaMa (Large Mask Inpainting) using ONNX Runtime Web
 * 
 * This provides AI-powered content-aware fill using a pre-trained neural network.
 * Falls back to PatchMatch if the model is unavailable.
 */

import * as ort from 'onnxruntime-web';

// Model configuration
const MODEL_URL = '/models/model_fp16.onnx'; // Host this file in public/models/
const MODEL_SIZE = 512; // LaMa works best at 512x512

let session: ort.InferenceSession | null = null;
let sessionLoading: Promise<ort.InferenceSession | null> | null = null;
let modelAvailable = true;

/**
 * Initialize ONNX Runtime and load the LaMa model
 */
async function initSession(): Promise<ort.InferenceSession | null> {
  if (session) return session;
  if (sessionLoading) return sessionLoading;
  
  sessionLoading = (async () => {
    try {
      // Configure ONNX Runtime
      ort.env.wasm.wasmPaths = '/';
      
      // Try WebGPU first, fall back to WebAssembly
      const providers: string[] = [];
      
      // Check for WebGPU support
      if ('gpu' in navigator) {
        providers.push('webgpu');
      }
      providers.push('wasm');
      
      console.log('Loading LaMa model...', { providers });
      
      session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: providers,
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
  return modelAvailable;
}

/**
 * Preload the model (call on app start)
 */
export async function preloadLamaModel(): Promise<boolean> {
  const sess = await initSession();
  return sess !== null;
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
  
  // Expand bounds with padding for context
  const padding = 50;
  const workBounds = {
    minX: Math.max(0, bounds.minX - padding),
    minY: Math.max(0, bounds.minY - padding),
    maxX: Math.min(width - 1, bounds.maxX + padding),
    maxY: Math.min(height - 1, bounds.maxY + padding),
  };
  
  const regionWidth = workBounds.maxX - workBounds.minX + 1;
  const regionHeight = workBounds.maxY - workBounds.minY + 1;
  
  // Calculate scale to fit in MODEL_SIZE
  const scale = Math.min(MODEL_SIZE / regionWidth, MODEL_SIZE / regionHeight, 1);
  const scaledWidth = Math.round(regionWidth * scale);
  const scaledHeight = Math.round(regionHeight * scale);
  
  console.log('LaMa inpainting:', {
    region: `${regionWidth}x${regionHeight}`,
    scaled: `${scaledWidth}x${scaledHeight}`,
    modelSize: MODEL_SIZE
  });
  
  // Create input tensors
  const imgTensor = new Float32Array(1 * 3 * MODEL_SIZE * MODEL_SIZE);
  const maskTensor = new Float32Array(1 * 1 * MODEL_SIZE * MODEL_SIZE);
  
  // Fill with padding (black/zero)
  imgTensor.fill(0);
  maskTensor.fill(0);
  
  // Extract and scale region to tensor
  const offsetX = Math.floor((MODEL_SIZE - scaledWidth) / 2);
  const offsetY = Math.floor((MODEL_SIZE - scaledHeight) / 2);
  
  for (let sy = 0; sy < scaledHeight; sy++) {
    for (let sx = 0; sx < scaledWidth; sx++) {
      // Map to original coordinates
      const origX = Math.floor(sx / scale) + workBounds.minX;
      const origY = Math.floor(sy / scale) + workBounds.minY;
      
      if (origX < 0 || origX >= width || origY < 0 || origY >= height) continue;
      
      const srcIdx = (origY * width + origX) * 4;
      const dstX = sx + offsetX;
      const dstY = sy + offsetY;
      const dstIdx = dstY * MODEL_SIZE + dstX;
      
      // Normalize to [0, 1] and arrange in CHW format
      imgTensor[dstIdx] = data[srcIdx] / 255; // R
      imgTensor[MODEL_SIZE * MODEL_SIZE + dstIdx] = data[srcIdx + 1] / 255; // G
      imgTensor[2 * MODEL_SIZE * MODEL_SIZE + dstIdx] = data[srcIdx + 2] / 255; // B
      
      // Mask (1 = area to inpaint)
      maskTensor[dstIdx] = mask[origY * width + origX] > 0.5 ? 1 : 0;
    }
  }
  
  try {
    // Run inference
    const feeds: Record<string, ort.Tensor> = {
      [sess.inputNames[0]]: new ort.Tensor('float32', imgTensor, [1, 3, MODEL_SIZE, MODEL_SIZE]),
      [sess.inputNames[1]]: new ort.Tensor('float32', maskTensor, [1, 1, MODEL_SIZE, MODEL_SIZE]),
    };
    
    const results = await sess.run(feeds);
    const outputName = sess.outputNames[0];
    const outputTensor = results[outputName].data as Float32Array;
    
    console.log(`LaMa inference completed in ${(performance.now() - startTime).toFixed(0)}ms`);
    
    // Create output ImageData
    const resultData = new Uint8ClampedArray(width * height * 4);
    resultData.set(data); // Copy original
    
    // Map output back to original coordinates
    for (let sy = 0; sy < scaledHeight; sy++) {
      for (let sx = 0; sx < scaledWidth; sx++) {
        const origX = Math.floor(sx / scale) + workBounds.minX;
        const origY = Math.floor(sy / scale) + workBounds.minY;
        
        if (origX < 0 || origX >= width || origY < 0 || origY >= height) continue;
        
        const maskVal = mask[origY * width + origX];
        if (maskVal < 0.1) continue; // Only update masked pixels
        
        const dstX = sx + offsetX;
        const dstY = sy + offsetY;
        const srcIdx = dstY * MODEL_SIZE + dstX;
        
        // Extract from CHW format and denormalize
        const r = Math.round(outputTensor[srcIdx] * 255);
        const g = Math.round(outputTensor[MODEL_SIZE * MODEL_SIZE + srcIdx] * 255);
        const b = Math.round(outputTensor[2 * MODEL_SIZE * MODEL_SIZE + srcIdx] * 255);
        
        const dstIdx = (origY * width + origX) * 4;
        
        // Blend based on mask weight
        const blend = Math.min(1, maskVal);
        resultData[dstIdx] = Math.round(resultData[dstIdx] * (1 - blend) + Math.max(0, Math.min(255, r)) * blend);
        resultData[dstIdx + 1] = Math.round(resultData[dstIdx + 1] * (1 - blend) + Math.max(0, Math.min(255, g)) * blend);
        resultData[dstIdx + 2] = Math.round(resultData[dstIdx + 2] * (1 - blend) + Math.max(0, Math.min(255, b)) * blend);
      }
    }
    
    // Apply edge feathering
    applyEdgeFeathering(resultData, data, mask, width, height, bounds);
    
    // Color matching
    matchColorStats(resultData, data, mask, width, height, bounds);
    
    return new ImageData(resultData, width, height);
    
  } catch (error) {
    console.error('LaMa inference failed:', error);
    return null;
  }
}

/**
 * Apply Gaussian-like feathering at mask edges
 */
function applyEdgeFeathering(
  result: Uint8ClampedArray,
  _original: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const featherRadius = 5;
  const temp = new Uint8ClampedArray(result);
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      const maskVal = mask[idx];
      
      // Only feather edge pixels
      if (maskVal < 0.1 || maskVal > 0.9) continue;
      
      let sumR = 0, sumG = 0, sumB = 0;
      let totalWeight = 0;
      
      for (let dy = -featherRadius; dy <= featherRadius; dy++) {
        for (let dx = -featherRadius; dx <= featherRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const dist = Math.sqrt(dx * dx + dy * dy);
          const weight = Math.exp(-(dist * dist) / (2 * featherRadius * featherRadius));
          
          const nIdx = (ny * width + nx) * 4;
          sumR += temp[nIdx] * weight;
          sumG += temp[nIdx + 1] * weight;
          sumB += temp[nIdx + 2] * weight;
          totalWeight += weight;
        }
      }
      
      if (totalWeight > 0) {
        const pixelIdx = idx * 4;
        result[pixelIdx] = Math.round(sumR / totalWeight);
        result[pixelIdx + 1] = Math.round(sumG / totalWeight);
        result[pixelIdx + 2] = Math.round(sumB / totalWeight);
      }
    }
  }
}

/**
 * Match color statistics between filled region and surrounding area
 */
function matchColorStats(
  result: Uint8ClampedArray,
  original: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  // Compute mean/std of surrounding ring (border pixels)
  let srcMeanR = 0, srcMeanG = 0, srcMeanB = 0;
  let srcStdR = 0, srcStdG = 0, srcStdB = 0;
  let srcCount = 0;
  
  // First pass: compute means
  for (let y = bounds.minY - 10; y <= bounds.maxY + 10; y++) {
    for (let x = bounds.minX - 10; x <= bounds.maxX + 10; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal > 0.1 && maskVal < 0.5) { // Border region
        const idx = (y * width + x) * 4;
        srcMeanR += original[idx];
        srcMeanG += original[idx + 1];
        srcMeanB += original[idx + 2];
        srcCount++;
      }
    }
  }
  
  if (srcCount < 10) return; // Not enough border pixels
  
  srcMeanR /= srcCount;
  srcMeanG /= srcCount;
  srcMeanB /= srcCount;
  
  // Second pass: compute std
  for (let y = bounds.minY - 10; y <= bounds.maxY + 10; y++) {
    for (let x = bounds.minX - 10; x <= bounds.maxX + 10; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal > 0.1 && maskVal < 0.5) {
        const idx = (y * width + x) * 4;
        srcStdR += Math.pow(original[idx] - srcMeanR, 2);
        srcStdG += Math.pow(original[idx + 1] - srcMeanG, 2);
        srcStdB += Math.pow(original[idx + 2] - srcMeanB, 2);
      }
    }
  }
  
  srcStdR = Math.sqrt(srcStdR / srcCount) || 1;
  srcStdG = Math.sqrt(srcStdG / srcCount) || 1;
  srcStdB = Math.sqrt(srcStdB / srcCount) || 1;
  
  // Compute mean/std of filled region
  let dstMeanR = 0, dstMeanG = 0, dstMeanB = 0;
  let dstCount = 0;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal > 0.5) {
        const idx = (y * width + x) * 4;
        dstMeanR += result[idx];
        dstMeanG += result[idx + 1];
        dstMeanB += result[idx + 2];
        dstCount++;
      }
    }
  }
  
  if (dstCount < 10) return;
  
  dstMeanR /= dstCount;
  dstMeanG /= dstCount;
  dstMeanB /= dstCount;
  
  let dstStdR = 0, dstStdG = 0, dstStdB = 0;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal > 0.5) {
        const idx = (y * width + x) * 4;
        dstStdR += Math.pow(result[idx] - dstMeanR, 2);
        dstStdG += Math.pow(result[idx + 1] - dstMeanG, 2);
        dstStdB += Math.pow(result[idx + 2] - dstMeanB, 2);
      }
    }
  }
  
  dstStdR = Math.sqrt(dstStdR / dstCount) || 1;
  dstStdG = Math.sqrt(dstStdG / dstCount) || 1;
  dstStdB = Math.sqrt(dstStdB / dstCount) || 1;
  
  // Apply color matching: (pixel - dstMean) * (srcStd / dstStd) + srcMean
  const scaleR = srcStdR / dstStdR;
  const scaleG = srcStdG / dstStdG;
  const scaleB = srcStdB / dstStdB;
  
  // Limit scale to avoid extreme adjustments
  const maxScale = 1.5;
  const clampedScaleR = Math.min(maxScale, Math.max(1 / maxScale, scaleR));
  const clampedScaleG = Math.min(maxScale, Math.max(1 / maxScale, scaleG));
  const clampedScaleB = Math.min(maxScale, Math.max(1 / maxScale, scaleB));
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal < 0.3) continue;
      
      const idx = (y * width + x) * 4;
      const blend = Math.min(1, (maskVal - 0.3) / 0.5); // Gradual blend
      
      const newR = (result[idx] - dstMeanR) * clampedScaleR + srcMeanR;
      const newG = (result[idx + 1] - dstMeanG) * clampedScaleG + srcMeanG;
      const newB = (result[idx + 2] - dstMeanB) * clampedScaleB + srcMeanB;
      
      result[idx] = Math.round(result[idx] * (1 - blend * 0.5) + Math.max(0, Math.min(255, newR)) * blend * 0.5);
      result[idx + 1] = Math.round(result[idx + 1] * (1 - blend * 0.5) + Math.max(0, Math.min(255, newG)) * blend * 0.5);
      result[idx + 2] = Math.round(result[idx + 2] * (1 - blend * 0.5) + Math.max(0, Math.min(255, newB)) * blend * 0.5);
    }
  }
}

