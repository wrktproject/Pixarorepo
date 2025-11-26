/**
 * Content-Aware Fill Implementation
 * Fast texture synthesis using downscaled processing
 */

export interface ContentAwareFillOptions {
  quality?: 'fast' | 'medium' | 'high';
}

/**
 * Fast content-aware fill using multi-resolution approach
 * Works at lower resolution for speed, then upscales
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  const { quality = 'fast' } = options;
  
  // Calculate scale factor based on mask size
  const maskWidth = bounds.maxX - bounds.minX;
  const maskHeight = bounds.maxY - bounds.minY;
  const maskPixels = maskWidth * maskHeight;
  
  // For large areas, work at reduced resolution
  const maxWorkingPixels = quality === 'fast' ? 50000 : quality === 'medium' ? 100000 : 200000;
  const scale = maskPixels > maxWorkingPixels ? Math.sqrt(maxWorkingPixels / maskPixels) : 1;
  
  console.log('Content-aware fill:', { 
    maskPixels, 
    scale: scale.toFixed(2),
    quality
  });
  
  if (scale < 0.9) {
    // Work at reduced resolution
    fillAtReducedResolution(imageData, mask, bounds, scale);
  } else {
    // Work at full resolution
    fillDirect(imageData, mask, bounds);
  }
  
  console.log('Content-aware fill complete');
}

/**
 * Fill at reduced resolution for large areas
 */
function fillAtReducedResolution(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  scale: number
): void {
  const { width, height, data } = imageData;
  
  // Expand bounds for context
  const padding = Math.ceil(50 / scale);
  const workBounds = {
    minX: Math.max(0, bounds.minX - padding),
    minY: Math.max(0, bounds.minY - padding),
    maxX: Math.min(width - 1, bounds.maxX + padding),
    maxY: Math.min(height - 1, bounds.maxY + padding),
  };
  
  const srcWidth = workBounds.maxX - workBounds.minX + 1;
  const srcHeight = workBounds.maxY - workBounds.minY + 1;
  const dstWidth = Math.ceil(srcWidth * scale);
  const dstHeight = Math.ceil(srcHeight * scale);
  
  // Downsample image region
  const downsampled = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const downMask = new Float32Array(dstWidth * dstHeight);
  
  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.floor(dx / scale) + workBounds.minX;
      const sy = Math.floor(dy / scale) + workBounds.minY;
      
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (dy * dstWidth + dx) * 4;
      
      downsampled[dstIdx] = data[srcIdx];
      downsampled[dstIdx + 1] = data[srcIdx + 1];
      downsampled[dstIdx + 2] = data[srcIdx + 2];
      downsampled[dstIdx + 3] = 255;
      
      downMask[dy * dstWidth + dx] = mask[sy * width + sx];
    }
  }
  
  // Fill at low resolution
  const scaledBounds = {
    minX: Math.floor((bounds.minX - workBounds.minX) * scale),
    minY: Math.floor((bounds.minY - workBounds.minY) * scale),
    maxX: Math.ceil((bounds.maxX - workBounds.minX) * scale),
    maxY: Math.ceil((bounds.maxY - workBounds.minY) * scale),
  };
  
  fillTextureAtScale(downsampled, downMask, dstWidth, dstHeight, scaledBounds);
  
  // Upsample result back
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskVal = mask[y * width + x];
      if (maskVal < 0.05) continue;
      
      // Bilinear interpolation from downsampled
      const dx = (x - workBounds.minX) * scale;
      const dy = (y - workBounds.minY) * scale;
      
      const x0 = Math.floor(dx);
      const y0 = Math.floor(dy);
      const x1 = Math.min(x0 + 1, dstWidth - 1);
      const y1 = Math.min(y0 + 1, dstHeight - 1);
      
      const fx = dx - x0;
      const fy = dy - y0;
      
      const idx00 = (y0 * dstWidth + x0) * 4;
      const idx10 = (y0 * dstWidth + x1) * 4;
      const idx01 = (y1 * dstWidth + x0) * 4;
      const idx11 = (y1 * dstWidth + x1) * 4;
      
      const r = bilinear(downsampled[idx00], downsampled[idx10], downsampled[idx01], downsampled[idx11], fx, fy);
      const g = bilinear(downsampled[idx00 + 1], downsampled[idx10 + 1], downsampled[idx01 + 1], downsampled[idx11 + 1], fx, fy);
      const b = bilinear(downsampled[idx00 + 2], downsampled[idx10 + 2], downsampled[idx01 + 2], downsampled[idx11 + 2], fx, fy);
      
      const pixelIdx = (y * width + x) * 4;
      
      // Blend based on mask
      data[pixelIdx] = Math.round(data[pixelIdx] * (1 - maskVal) + r * maskVal);
      data[pixelIdx + 1] = Math.round(data[pixelIdx + 1] * (1 - maskVal) + g * maskVal);
      data[pixelIdx + 2] = Math.round(data[pixelIdx + 2] * (1 - maskVal) + b * maskVal);
    }
  }
}

function bilinear(v00: number, v10: number, v01: number, v11: number, fx: number, fy: number): number {
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

/**
 * Fast texture fill at given scale
 */
function fillTextureAtScale(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const patchSize = 5;
  const halfPatch = 2;
  
  // Collect source patches from outside mask
  const sourcePatches: Array<{ x: number, y: number, colors: number[] }> = [];
  const step = Math.max(1, patchSize - 1);
  
  for (let y = halfPatch; y < height - halfPatch; y += step) {
    for (let x = halfPatch; x < width - halfPatch; x += step) {
      // Check if patch is fully outside mask
      let inMask = false;
      for (let dy = -halfPatch; dy <= halfPatch && !inMask; dy++) {
        for (let dx = -halfPatch; dx <= halfPatch && !inMask; dx++) {
          if (mask[(y + dy) * width + (x + dx)] > 0.3) inMask = true;
        }
      }
      if (inMask) continue;
      
      // Store patch
      const colors: number[] = [];
      for (let dy = -halfPatch; dy <= halfPatch; dy++) {
        for (let dx = -halfPatch; dx <= halfPatch; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          colors.push(data[idx], data[idx + 1], data[idx + 2]);
        }
      }
      sourcePatches.push({ x, y, colors });
    }
  }
  
  console.log(`Found ${sourcePatches.length} source patches`);
  
  if (sourcePatches.length === 0) {
    // Fallback: just use edge colors
    fillFromEdges(data, mask, width, height, bounds);
    return;
  }
  
  // Create result buffer
  const result = new Uint8ClampedArray(data);
  const filled = new Float32Array(mask.length);
  
  // Fill from edges inward using best matching patches
  let iterations = 0;
  const maxIter = 1000;
  
  while (iterations < maxIter) {
    let anyFilled = false;
    
    // Find boundary pixels
    for (let y = Math.max(halfPatch, bounds.minY); y <= Math.min(height - halfPatch - 1, bounds.maxY); y++) {
      for (let x = Math.max(halfPatch, bounds.minX); x <= Math.min(width - halfPatch - 1, bounds.maxX); x++) {
        const idx = y * width + x;
        if (mask[idx] < 0.3 || filled[idx] > 0) continue;
        
        // Check if has filled/unmasked neighbor
        let hasContext = false;
        for (let dy = -1; dy <= 1 && !hasContext; dy++) {
          for (let dx = -1; dx <= 1 && !hasContext; dx++) {
            const nIdx = (y + dy) * width + (x + dx);
            if (mask[nIdx] < 0.3 || filled[nIdx] > 0) hasContext = true;
          }
        }
        if (!hasContext) continue;
        
        // Get context patch
        const context: number[] = [];
        const contextMask: boolean[] = [];
        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const pIdx = ((y + dy) * width + (x + dx)) * 4;
            const mIdx = (y + dy) * width + (x + dx);
            context.push(result[pIdx], result[pIdx + 1], result[pIdx + 2]);
            contextMask.push(mask[mIdx] < 0.3 || filled[mIdx] > 0);
          }
        }
        
        // Find best matching source patch
        let bestPatch = sourcePatches[0];
        let bestScore = Infinity;
        
        // Sample random patches for speed
        const sampleSize = Math.min(sourcePatches.length, 50);
        const sampleStep = Math.max(1, Math.floor(sourcePatches.length / sampleSize));
        
        for (let i = 0; i < sourcePatches.length; i += sampleStep) {
          const patch = sourcePatches[i];
          let score = 0;
          let count = 0;
          
          for (let j = 0; j < context.length; j += 3) {
            if (!contextMask[j / 3]) continue;
            const dr = context[j] - patch.colors[j];
            const dg = context[j + 1] - patch.colors[j + 1];
            const db = context[j + 2] - patch.colors[j + 2];
            score += dr * dr + dg * dg + db * db;
            count++;
          }
          
          if (count > 0 && score / count < bestScore) {
            bestScore = score / count;
            bestPatch = patch;
          }
        }
        
        // Copy center pixel from best patch
        const centerOffset = (halfPatch * (patchSize) + halfPatch) * 3;
        const pixelIdx = idx * 4;
        result[pixelIdx] = bestPatch.colors[centerOffset];
        result[pixelIdx + 1] = bestPatch.colors[centerOffset + 1];
        result[pixelIdx + 2] = bestPatch.colors[centerOffset + 2];
        filled[idx] = 1;
        anyFilled = true;
      }
    }
    
    if (!anyFilled) break;
    iterations++;
  }
  
  // Copy result back
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
}

/**
 * Simple fallback: fill from edge colors
 */
function fillFromEdges(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  _height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  // Collect edge colors
  const edgeColors: Array<{ r: number, g: number, b: number }> = [];
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0.1 && mask[idx] < 0.5) {
        const pixelIdx = idx * 4;
        edgeColors.push({
          r: data[pixelIdx],
          g: data[pixelIdx + 1],
          b: data[pixelIdx + 2]
        });
      }
    }
  }
  
  if (edgeColors.length === 0) return;
  
  // Calculate average edge color
  let avgR = 0, avgG = 0, avgB = 0;
  for (const c of edgeColors) {
    avgR += c.r;
    avgG += c.g;
    avgB += c.b;
  }
  avgR /= edgeColors.length;
  avgG /= edgeColors.length;
  avgB /= edgeColors.length;
  
  // Fill with average + slight variation
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      const maskVal = mask[idx];
      if (maskVal < 0.3) continue;
      
      // Add subtle noise
      const noise = (Math.random() - 0.5) * 20;
      
      const pixelIdx = idx * 4;
      data[pixelIdx] = Math.max(0, Math.min(255, Math.round(avgR + noise)));
      data[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(avgG + noise)));
      data[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(avgB + noise)));
    }
  }
}

/**
 * Fill directly at full resolution (for smaller areas)
 */
function fillDirect(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  fillTextureAtScale(
    imageData.data,
    mask,
    imageData.width,
    imageData.height,
    bounds
  );
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
