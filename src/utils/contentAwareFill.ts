/**
 * Content-Aware Fill Implementation
 * 
 * Strategy:
 * 1. Try LaMa neural network (best quality) via ONNX Runtime
 * 2. Fall back to PatchMatch if model unavailable
 * 3. Apply edge feathering and color matching
 */

import { runLamaInpainting, isLamaAvailable, preloadLamaModel } from './lamaInpainting';

export interface ContentAwareFillOptions {
  maxWorkingSize?: number;
  patchSize?: number;
  iterations?: number;
  useLama?: boolean;
}

// Re-export for preloading
export { preloadLamaModel, isLamaAvailable };

/**
 * Main content-aware fill function
 * Tries LaMa first, falls back to PatchMatch
 */
export async function contentAwareFillWithMaskAsync(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): Promise<void> {
  const { useLama = true } = options;
  
  // Try LaMa first if enabled
  if (useLama && isLamaAvailable()) {
    console.log('Trying LaMa inpainting...');
    const result = await runLamaInpainting(imageData, mask, bounds);
    
    if (result) {
      // Copy result back to imageData
      imageData.data.set(result.data);
      console.log('LaMa inpainting successful');
      return;
    }
    
    console.log('LaMa failed, falling back to PatchMatch');
  }
  
  // Fall back to PatchMatch
  contentAwareFillWithMask(imageData, mask, bounds, options);
}

/**
 * Synchronous PatchMatch-based fill (fallback)
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  const { width, height, data } = imageData;
  const { maxWorkingSize = 512, patchSize = 7, iterations = 5 } = options;
  
  // Calculate region size
  const regionWidth = bounds.maxX - bounds.minX + 1;
  const regionHeight = bounds.maxY - bounds.minY + 1;
  
  // Expand bounds for context (need surrounding pixels for patches)
  const contextPad = Math.max(patchSize * 2, 50);
  const workBounds = {
    minX: Math.max(0, bounds.minX - contextPad),
    minY: Math.max(0, bounds.minY - contextPad),
    maxX: Math.min(width - 1, bounds.maxX + contextPad),
    maxY: Math.min(height - 1, bounds.maxY + contextPad),
  };
  
  const workWidth = workBounds.maxX - workBounds.minX + 1;
  const workHeight = workBounds.maxY - workBounds.minY + 1;
  
  // Calculate scale factor
  const maxDim = Math.max(workWidth, workHeight);
  const scale = maxDim > maxWorkingSize ? maxWorkingSize / maxDim : 1;
  
  const scaledWidth = Math.ceil(workWidth * scale);
  const scaledHeight = Math.ceil(workHeight * scale);
  const scaledPatchSize = Math.max(3, Math.ceil(patchSize * scale));
  
  console.log('Content-aware fill:', {
    original: `${regionWidth}x${regionHeight}`,
    working: `${scaledWidth}x${scaledHeight}`,
    scale: scale.toFixed(3),
    patchSize: scaledPatchSize,
    iterations
  });
  
  const startTime = performance.now();
  
  // Extract and downsample working region
  const { image: scaledImage, mask: scaledMask } = downsampleRegion(
    data, mask, width, workBounds, scaledWidth, scaledHeight, scale
  );
  
  // Compute scaled mask bounds
  const scaledBounds = {
    minX: Math.floor((bounds.minX - workBounds.minX) * scale),
    minY: Math.floor((bounds.minY - workBounds.minY) * scale),
    maxX: Math.ceil((bounds.maxX - workBounds.minX) * scale),
    maxY: Math.ceil((bounds.maxY - workBounds.minY) * scale),
  };
  
  // Run PatchMatch at low resolution
  patchMatchFill(scaledImage, scaledMask, scaledWidth, scaledHeight, scaledBounds, scaledPatchSize, iterations);
  
  // Upsample and blend back to original
  upsampleAndBlend(data, scaledImage, mask, width, height, workBounds, scaledWidth, scaledHeight, scale, bounds);
  
  // Gradient blend at edges
  gradientBlendEdges(data, mask, width, bounds);
  
  console.log(`Content-aware fill complete in ${(performance.now() - startTime).toFixed(0)}ms`);
}

/**
 * Downsample image region and mask
 */
function downsampleRegion(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  dstWidth: number,
  dstHeight: number,
  scale: number
): { image: Uint8ClampedArray; mask: Float32Array } {
  const image = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const dstMask = new Float32Array(dstWidth * dstHeight);
  
  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.floor(dx / scale) + bounds.minX;
      const sy = Math.floor(dy / scale) + bounds.minY;
      
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (dy * dstWidth + dx) * 4;
      
      image[dstIdx] = data[srcIdx];
      image[dstIdx + 1] = data[srcIdx + 1];
      image[dstIdx + 2] = data[srcIdx + 2];
      image[dstIdx + 3] = 255;
      
      dstMask[dy * dstWidth + dx] = mask[sy * width + sx];
    }
  }
  
  return { image, mask: dstMask };
}

/**
 * PatchMatch-style fill algorithm
 * Uses propagation + random search for fast approximate nearest neighbor
 */
function patchMatchFill(
  image: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  patchSize: number,
  iterations: number
): void {
  const halfPatch = Math.floor(patchSize / 2);
  
  // NNF (Nearest Neighbor Field) - stores offset to best matching source patch
  // For each masked pixel, store the (dx, dy) offset to the best source
  const nnfX = new Int16Array(width * height);
  const nnfY = new Int16Array(width * height);
  const nnfDist = new Float32Array(width * height);
  nnfDist.fill(Infinity);
  
  // Collect source patch centers (valid patches fully outside mask)
  const sourceCenters: Array<{ x: number; y: number }> = [];
  for (let y = halfPatch; y < height - halfPatch; y++) {
    for (let x = halfPatch; x < width - halfPatch; x++) {
      let valid = true;
      for (let py = -halfPatch; py <= halfPatch && valid; py++) {
        for (let px = -halfPatch; px <= halfPatch && valid; px++) {
          if (mask[(y + py) * width + (x + px)] > 0.3) valid = false;
        }
      }
      if (valid) sourceCenters.push({ x, y });
    }
  }
  
  if (sourceCenters.length === 0) {
    console.warn('No valid source patches found');
    return;
  }
  
  console.log(`PatchMatch: ${sourceCenters.length} source patches`);
  
  // Initialize NNF with random assignments
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] < 0.3) continue;
      
      const src = sourceCenters[Math.floor(Math.random() * sourceCenters.length)];
      nnfX[idx] = src.x - x;
      nnfY[idx] = src.y - y;
    }
  }
  
  // PatchMatch iterations: propagate + random search
  for (let iter = 0; iter < iterations; iter++) {
    // Alternate scan direction
    const reverse = iter % 2 === 1;
    
    const yStart = reverse ? bounds.maxY : bounds.minY;
    const yEnd = reverse ? bounds.minY - 1 : bounds.maxY + 1;
    const yStep = reverse ? -1 : 1;
    
    const xStart = reverse ? bounds.maxX : bounds.minX;
    const xEnd = reverse ? bounds.minX - 1 : bounds.maxX + 1;
    const xStep = reverse ? -1 : 1;
    
    for (let y = yStart; y !== yEnd; y += yStep) {
      for (let x = xStart; x !== xEnd; x += xStep) {
        const idx = y * width + x;
        if (mask[idx] < 0.3) continue;
        
        // Current best
        let bestDx = nnfX[idx];
        let bestDy = nnfY[idx];
        let bestDist = computePatchDistance(image, mask, width, height, x, y, x + bestDx, y + bestDy, halfPatch);
        
        // Propagation: check if neighbors have better matches
        const propDirs = reverse ? [[1, 0], [0, 1]] : [[-1, 0], [0, -1]];
        for (const [dx, dy] of propDirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const nIdx = ny * width + nx;
          const candDx = nnfX[nIdx];
          const candDy = nnfY[nIdx];
          
          // Try this neighbor's offset
          const srcX = x + candDx;
          const srcY = y + candDy;
          
          if (srcX < halfPatch || srcX >= width - halfPatch || 
              srcY < halfPatch || srcY >= height - halfPatch) continue;
          
          const dist = computePatchDistance(image, mask, width, height, x, y, srcX, srcY, halfPatch);
          if (dist < bestDist) {
            bestDist = dist;
            bestDx = candDx;
            bestDy = candDy;
          }
        }
        
        // Random search: try random offsets at decreasing radii
        let searchRadius = Math.max(width, height);
        while (searchRadius > 1) {
          const randDx = bestDx + Math.floor((Math.random() * 2 - 1) * searchRadius);
          const randDy = bestDy + Math.floor((Math.random() * 2 - 1) * searchRadius);
          
          const srcX = x + randDx;
          const srcY = y + randDy;
          
          if (srcX >= halfPatch && srcX < width - halfPatch && 
              srcY >= halfPatch && srcY < height - halfPatch) {
            // Check if source is valid (not in mask)
            let valid = true;
            for (let py = -halfPatch; py <= halfPatch && valid; py++) {
              for (let px = -halfPatch; px <= halfPatch && valid; px++) {
                if (mask[(srcY + py) * width + (srcX + px)] > 0.3) valid = false;
              }
            }
            
            if (valid) {
              const dist = computePatchDistance(image, mask, width, height, x, y, srcX, srcY, halfPatch);
              if (dist < bestDist) {
                bestDist = dist;
                bestDx = randDx;
                bestDy = randDy;
              }
            }
          }
          
          searchRadius = Math.floor(searchRadius / 2);
        }
        
        nnfX[idx] = bestDx;
        nnfY[idx] = bestDy;
        nnfDist[idx] = bestDist;
      }
    }
  }
  
  // Fill masked pixels using NNF
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] < 0.3) continue;
      
      const srcX = x + nnfX[idx];
      const srcY = y + nnfY[idx];
      
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * 4;
        const dstIdx = idx * 4;
        
        image[dstIdx] = image[srcIdx];
        image[dstIdx + 1] = image[srcIdx + 1];
        image[dstIdx + 2] = image[srcIdx + 2];
      }
    }
  }
}

/**
 * Compute SSD distance between two patches (only using known pixels)
 */
function computePatchDistance(
  image: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  x1: number, y1: number,
  x2: number, y2: number,
  halfPatch: number
): number {
  let sum = 0;
  let count = 0;
  
  for (let dy = -halfPatch; dy <= halfPatch; dy++) {
    for (let dx = -halfPatch; dx <= halfPatch; dx++) {
      const tx = x1 + dx;
      const ty = y1 + dy;
      const sx = x2 + dx;
      const sy = y2 + dy;
      
      if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      
      // Only compare known pixels in target
      if (mask[ty * width + tx] > 0.3) continue;
      
      const tIdx = (ty * width + tx) * 4;
      const sIdx = (sy * width + sx) * 4;
      
      const dr = image[tIdx] - image[sIdx];
      const dg = image[tIdx + 1] - image[sIdx + 1];
      const db = image[tIdx + 2] - image[sIdx + 2];
      
      sum += dr * dr + dg * dg + db * db;
      count++;
    }
  }
  
  return count > 0 ? sum / count : Infinity;
}

/**
 * Upsample filled region and blend into original image
 */
function upsampleAndBlend(
  data: Uint8ClampedArray,
  scaledImage: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  workBounds: { minX: number; minY: number; maxX: number; maxY: number },
  scaledWidth: number,
  scaledHeight: number,
  scale: number,
  maskBounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  // Bilinear upsample with mask-based blending
  for (let y = maskBounds.minY; y <= maskBounds.maxY; y++) {
    for (let x = maskBounds.minX; x <= maskBounds.maxX; x++) {
      if (y < 0 || y >= height || x < 0 || x >= width) continue;
      
      const maskVal = mask[y * width + x];
      if (maskVal < 0.05) continue;
      
      // Map to scaled coordinates
      const sx = (x - workBounds.minX) * scale;
      const sy = (y - workBounds.minY) * scale;
      
      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, scaledWidth - 1);
      const y1 = Math.min(y0 + 1, scaledHeight - 1);
      
      const fx = sx - x0;
      const fy = sy - y0;
      
      const idx00 = (y0 * scaledWidth + x0) * 4;
      const idx10 = (y0 * scaledWidth + x1) * 4;
      const idx01 = (y1 * scaledWidth + x0) * 4;
      const idx11 = (y1 * scaledWidth + x1) * 4;
      
      const r = bilinear(scaledImage[idx00], scaledImage[idx10], scaledImage[idx01], scaledImage[idx11], fx, fy);
      const g = bilinear(scaledImage[idx00 + 1], scaledImage[idx10 + 1], scaledImage[idx01 + 1], scaledImage[idx11 + 1], fx, fy);
      const b = bilinear(scaledImage[idx00 + 2], scaledImage[idx10 + 2], scaledImage[idx01 + 2], scaledImage[idx11 + 2], fx, fy);
      
      const pixelIdx = (y * width + x) * 4;
      
      // Blend based on mask (soft edges)
      const blend = Math.min(1, maskVal);
      data[pixelIdx] = Math.round(data[pixelIdx] * (1 - blend) + r * blend);
      data[pixelIdx + 1] = Math.round(data[pixelIdx + 1] * (1 - blend) + g * blend);
      data[pixelIdx + 2] = Math.round(data[pixelIdx + 2] * (1 - blend) + b * blend);
    }
  }
}

function bilinear(v00: number, v10: number, v01: number, v11: number, fx: number, fy: number): number {
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

/**
 * Apply gradient-based edge blending (simplified Poisson-like blending)
 */
function gradientBlendEdges(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const blendRadius = 3;
  const temp = new Uint8ClampedArray(data);
  
  // Multiple passes for smoother transition
  for (let pass = 0; pass < 2; pass++) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const maskVal = mask[y * width + x];
        
        // Only blend edge pixels (transition zone)
        if (maskVal < 0.1 || maskVal > 0.9) continue;
        
        let sumR = 0, sumG = 0, sumB = 0;
        let totalWeight = 0;
        
        for (let dy = -blendRadius; dy <= blendRadius; dy++) {
          for (let dx = -blendRadius; dx <= blendRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= bounds.maxY + 1) continue;
            
            const dist = Math.sqrt(dx * dx + dy * dy);
            const weight = 1 / (1 + dist);
            
            const nIdx = (ny * width + nx) * 4;
            sumR += temp[nIdx] * weight;
            sumG += temp[nIdx + 1] * weight;
            sumB += temp[nIdx + 2] * weight;
            totalWeight += weight;
          }
        }
        
        if (totalWeight > 0) {
          const pixelIdx = (y * width + x) * 4;
          const blend = 0.5; // Blend factor
          data[pixelIdx] = Math.round(temp[pixelIdx] * (1 - blend) + (sumR / totalWeight) * blend);
          data[pixelIdx + 1] = Math.round(temp[pixelIdx + 1] * (1 - blend) + (sumG / totalWeight) * blend);
          data[pixelIdx + 2] = Math.round(temp[pixelIdx + 2] * (1 - blend) + (sumB / totalWeight) * blend);
        }
      }
    }
    
    // Copy for next pass
    for (let i = 0; i < data.length; i++) {
      temp[i] = data[i];
    }
  }
}

/**
 * Legacy content-aware fill (bounding box based)
 */
export function contentAwareFill(
  imageData: ImageData,
  maskRegion: { x: number; y: number; width: number; height: number }
): void {
  const { width, height: imgHeight } = imageData;
  
  const mask = new Float32Array(width * imgHeight);
  
  for (let y = 0; y < imgHeight; y++) {
    for (let x = 0; x < width; x++) {
      if (
        x >= maskRegion.x &&
        x < maskRegion.x + maskRegion.width &&
        y >= maskRegion.y &&
        y < maskRegion.y + maskRegion.height
      ) {
        mask[y * width + x] = 1;
      }
    }
  }
  
  const bounds = {
    minX: Math.max(0, maskRegion.x),
    minY: Math.max(0, maskRegion.y),
    maxX: Math.min(width - 1, maskRegion.x + maskRegion.width),
    maxY: Math.min(imgHeight - 1, maskRegion.y + maskRegion.height),
  };
  
  contentAwareFillWithMask(imageData, mask, bounds);
}
