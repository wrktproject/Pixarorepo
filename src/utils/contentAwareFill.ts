/**
 * Content-Aware Fill Implementation
 * 
 * Strategy:
 * 1. Try server-side AI inpainting (best quality, requires API key)
 * 2. Fall back to local algorithm if server unavailable
 * 
 * Local algorithm uses:
 * - Downscaling for performance
 * - Border propagation for color matching
 * - Texture transfer for natural look
 * - Poisson-like healing for seamless blending
 */

import { tryServerInpaint, isServerInpaintingAvailable } from './serverInpainting';

export interface ContentAwareFillOptions {
  maxWorkingSize?: number;
  patchSize?: number;
  iterations?: number;
  useServer?: boolean;  // Try server-side AI first
  onProgress?: (status: string) => void;
}

/**
 * Main content-aware fill function
 * Tries server-side AI first, falls back to local processing
 */
export async function contentAwareFillWithMaskAsync(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): Promise<void> {
  const { maxWorkingSize = 600, useServer = true, onProgress } = options;
  const { width, height, data } = imageData;
  
  // Try server-side AI first (much better quality)
  if (useServer && isServerInpaintingAvailable()) {
    onProgress?.('Using AI server for best quality...');
    console.log('Attempting server-side AI inpainting...');
    
    const result = await tryServerInpaint(imageData, mask, onProgress);
    
    if (result) {
      // Copy result back to original imageData
      console.log('Server inpainting successful!');
      
      // The server returns a full image, we need to composite it
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const maskVal = mask[y * width + x];
          if (maskVal > 0.1) {
            const idx = (y * width + x) * 4;
            // Blend based on mask
            const blend = Math.min(1, maskVal);
            data[idx] = Math.round(data[idx] * (1 - blend) + result.data[idx] * blend);
            data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + result.data[idx + 1] * blend);
            data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + result.data[idx + 2] * blend);
          }
        }
      }
      return;
    }
    
    console.log('Server inpainting failed, falling back to local processing');
    onProgress?.('Falling back to local processing...');
  }
  
  // Calculate region size
  const regionWidth = bounds.maxX - bounds.minX + 1;
  const regionHeight = bounds.maxY - bounds.minY + 1;
  
  // Expand for context (need surrounding pixels for patch matching)
  const contextPad = 80;
  const workBounds = {
    minX: Math.max(0, bounds.minX - contextPad),
    minY: Math.max(0, bounds.minY - contextPad),
    maxX: Math.min(width - 1, bounds.maxX + contextPad),
    maxY: Math.min(height - 1, bounds.maxY + contextPad),
  };
  
  const workWidth = workBounds.maxX - workBounds.minX + 1;
  const workHeight = workBounds.maxY - workBounds.minY + 1;
  
  // Calculate scale for processing
  const maxDim = Math.max(workWidth, workHeight);
  const scale = maxDim > maxWorkingSize ? maxWorkingSize / maxDim : 1;
  
  const scaledWidth = Math.ceil(workWidth * scale);
  const scaledHeight = Math.ceil(workHeight * scale);
  
  console.log('Content-aware fill:', {
    region: `${regionWidth}x${regionHeight}`,
    workArea: `${workWidth}x${workHeight}`,
    scaled: `${scaledWidth}x${scaledHeight}`,
    scale: scale.toFixed(3)
  });
  
  const startTime = performance.now();
  
  if (scale < 1) {
    // Process at lower resolution
    const { scaledData, scaledMask } = downsampleForProcessing(
      data, mask, width, workBounds, scaledWidth, scaledHeight, scale
    );
    
    // Create scaled bounds (relative to work area)
    const scaledBounds = {
      minX: Math.floor((bounds.minX - workBounds.minX) * scale),
      minY: Math.floor((bounds.minY - workBounds.minY) * scale),
      maxX: Math.ceil((bounds.maxX - workBounds.minX) * scale),
      maxY: Math.ceil((bounds.maxY - workBounds.minY) * scale),
    };
    
    // Run inpainting at low resolution
    inpaintRegion(scaledData, scaledMask, scaledWidth, scaledHeight, scaledBounds);
    
    // Upsample back to original
    upsampleResult(data, scaledData, mask, width, height, workBounds, scaledWidth, scaledHeight, scale, bounds);
  } else {
    // Process at full resolution (small regions)
    inpaintRegion(data, mask, width, height, bounds);
  }
  
  // Apply automatic healing passes for seamless blending
  console.log('Applying healing passes...');
  applyHealingPasses(data, mask, width, height, bounds, 3);
  
  console.log(`Content-aware fill complete in ${(performance.now() - startTime).toFixed(0)}ms`);
}

/**
 * Apply Poisson-like healing passes to blend the filled region seamlessly
 * This is what makes the fill look natural
 */
function applyHealingPasses(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  passes: number
): void {
  const bw = bounds.maxX - bounds.minX + 1;
  const bh = bounds.maxY - bounds.minY + 1;
  
  // Create working buffer
  const buffer = new Float32Array(bw * bh * 3);
  
  // Initialize buffer with current colors
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = (y * width + x) * 4;
      const bufIdx = ((y - bounds.minY) * bw + (x - bounds.minX)) * 3;
      buffer[bufIdx] = data[idx];
      buffer[bufIdx + 1] = data[idx + 1];
      buffer[bufIdx + 2] = data[idx + 2];
    }
  }
  
  // Multiple healing passes
  for (let pass = 0; pass < passes; pass++) {
    // Jacobi relaxation iterations per pass
    const iterations = 20;
    
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
          const maskWeight = mask[y * width + x];
          // Only heal interior pixels
          if (maskWeight < 0.2) continue;
          
          const bufIdx = ((y - bounds.minY) * bw + (x - bounds.minX)) * 3;
          
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let count = 0;
            
            // Get 4-connected neighbors
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              
              if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) {
                // Use original image outside bounds
                sum += data[(ny * width + nx) * 4 + c];
              } else {
                const nBufIdx = ((ny - bounds.minY) * bw + (nx - bounds.minX)) * 3;
                const nWeight = mask[ny * width + nx];
                
                if (nWeight < 0.1) {
                  // Use original for unmasked pixels
                  sum += data[(ny * width + nx) * 4 + c];
                } else {
                  sum += buffer[nBufIdx + c];
                }
              }
              count++;
            }
            
            if (count > 0) {
              // Blend: more relaxation near edges, preserve interior
              const edgeFactor = Math.min(1, maskWeight * 2);
              const blendFactor = 0.25 * edgeFactor;
              buffer[bufIdx + c] = buffer[bufIdx + c] * (1 - blendFactor) + (sum / count) * blendFactor;
            }
          }
        }
      }
    }
  }
  
  // Apply result back to image with soft blending at edges
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x];
      if (maskWeight < 0.05) continue;
      
      const idx = (y * width + x) * 4;
      const bufIdx = ((y - bounds.minY) * bw + (x - bounds.minX)) * 3;
      
      // Soft blend based on mask
      const blend = Math.min(1, maskWeight);
      data[idx] = Math.round(data[idx] * (1 - blend) + Math.max(0, Math.min(255, buffer[bufIdx])) * blend);
      data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + Math.max(0, Math.min(255, buffer[bufIdx + 1])) * blend);
      data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + Math.max(0, Math.min(255, buffer[bufIdx + 2])) * blend);
    }
  }
}

/**
 * Downsample image and mask for processing
 */
function downsampleForProcessing(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  dstWidth: number,
  dstHeight: number,
  scale: number
): { scaledData: Uint8ClampedArray; scaledMask: Float32Array } {
  const scaledData = new Uint8ClampedArray(dstWidth * dstHeight * 4);
  const scaledMask = new Float32Array(dstWidth * dstHeight);
  
  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.floor(dx / scale) + bounds.minX;
      const sy = Math.floor(dy / scale) + bounds.minY;
      
      const srcIdx = (sy * width + sx) * 4;
      const dstIdx = (dy * dstWidth + dx) * 4;
      
      scaledData[dstIdx] = data[srcIdx];
      scaledData[dstIdx + 1] = data[srcIdx + 1];
      scaledData[dstIdx + 2] = data[srcIdx + 2];
      scaledData[dstIdx + 3] = 255;
      
      scaledMask[dy * dstWidth + dx] = mask[sy * width + sx];
    }
  }
  
  return { scaledData, scaledMask };
}

/**
 * Upsample processed result back to original resolution
 */
function upsampleResult(
  data: Uint8ClampedArray,
  scaledData: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  workBounds: { minX: number; minY: number; maxX: number; maxY: number },
  scaledWidth: number,
  scaledHeight: number,
  scale: number,
  maskBounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  // Bilinear upsample with mask blending
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
      
      const r = bilinear(scaledData[idx00], scaledData[idx10], scaledData[idx01], scaledData[idx11], fx, fy);
      const g = bilinear(scaledData[idx00 + 1], scaledData[idx10 + 1], scaledData[idx01 + 1], scaledData[idx11 + 1], fx, fy);
      const b = bilinear(scaledData[idx00 + 2], scaledData[idx10 + 2], scaledData[idx01 + 2], scaledData[idx11 + 2], fx, fy);
      
      const pixelIdx = (y * width + x) * 4;
      const blend = Math.min(1, maskVal);
      
      data[pixelIdx] = Math.round(data[pixelIdx] * (1 - blend) + r * blend);
      data[pixelIdx + 1] = Math.round(data[pixelIdx + 1] * (1 - blend) + g * blend);
      data[pixelIdx + 2] = Math.round(data[pixelIdx + 2] * (1 - blend) + b * blend);
    }
  }
  
  // Edge smoothing
  smoothEdges(data, mask, width, maskBounds);
}

function bilinear(v00: number, v10: number, v01: number, v11: number, fx: number, fy: number): number {
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

function smoothEdges(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const temp = new Uint8ClampedArray(data);
  
  for (let pass = 0; pass < 3; pass++) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const maskVal = mask[y * width + x];
        if (maskVal < 0.1 || maskVal > 0.9) continue;
        
        let sumR = 0, sumG = 0, sumB = 0, weight = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < bounds.minY || ny > bounds.maxY) continue;
            
            const w = 1 / (1 + Math.abs(dx) + Math.abs(dy));
            const nIdx = (ny * width + nx) * 4;
            sumR += temp[nIdx] * w;
            sumG += temp[nIdx + 1] * w;
            sumB += temp[nIdx + 2] * w;
            weight += w;
          }
        }
        
        if (weight > 0) {
          const idx = (y * width + x) * 4;
          data[idx] = Math.round(sumR / weight);
          data[idx + 1] = Math.round(sumG / weight);
          data[idx + 2] = Math.round(sumB / weight);
        }
      }
    }
    for (let i = 0; i < data.length; i++) temp[i] = data[i];
  }
}

/**
 * Core inpainting algorithm
 * Uses border-propagation: fills from boundary inward using nearby border colors
 * This creates smooth gradients that naturally match the surrounding area
 */
function inpaintRegion(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  // Count pixels to fill
  let pixelsToFill = 0;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] > 0.5) pixelsToFill++;
    }
  }
  console.log(`Filling ${pixelsToFill} pixels at ${width}x${height}`);
  
  // Create working mask and distance field
  const workMask = new Float32Array(mask);
  const distanceField = new Float32Array(width * height);
  distanceField.fill(Infinity);
  
  // Step 1: Find all border pixels and store their colors
  // Border = known pixels adjacent to mask
  const borderPixels: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
  
  for (let y = Math.max(0, bounds.minY - 5); y <= Math.min(height - 1, bounds.maxY + 5); y++) {
    for (let x = Math.max(0, bounds.minX - 5); x <= Math.min(width - 1, bounds.maxX + 5); x++) {
      // Skip if this pixel is masked
      if (mask[y * width + x] > 0.3) continue;
      
      // Check if adjacent to masked pixel
      let adjacentToMask = false;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (mask[ny * width + nx] > 0.3) {
            adjacentToMask = true;
            break;
          }
        }
      }
      
      if (adjacentToMask) {
        const idx = (y * width + x) * 4;
        borderPixels.push({
          x, y,
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2]
        });
        distanceField[y * width + x] = 0;
      }
    }
  }
  
  console.log(`Found ${borderPixels.length} border pixels`);
  
  if (borderPixels.length === 0) {
    console.warn('No border pixels found, using average fill');
    fillWithAverage(data, mask, width, height, bounds);
    return;
  }
  
  // Step 2: Compute distance field from border (simplified)
  // For each masked pixel, find distance to nearest border
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] < 0.5) continue;
      
      let minDist = Infinity;
      for (const bp of borderPixels) {
        const dist = Math.sqrt((x - bp.x) ** 2 + (y - bp.y) ** 2);
        if (dist < minDist) minDist = dist;
      }
      distanceField[y * width + x] = minDist;
    }
  }
  
  // Step 3: Fill pixels layer by layer from border inward
  // Process pixels in order of distance from border
  const maxDist = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const layerThickness = 2;
  
  for (let layer = 0; layer < maxDist; layer += layerThickness) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const idx = y * width + x;
        if (workMask[idx] < 0.5) continue;
        
        const dist = distanceField[idx];
        if (dist < layer || dist >= layer + layerThickness) continue;
        
        // Fill this pixel using weighted average of nearby known pixels
        // Weight by inverse distance squared
        let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
        const searchRadius = Math.max(10, Math.ceil(dist * 0.5));
        
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            
            // Only use known (filled) pixels
            if (workMask[ny * width + nx] > 0.3) continue;
            
            const pixelDist = Math.sqrt(dx * dx + dy * dy);
            if (pixelDist < 0.5) continue;
            
            // Prefer border pixels (they have original colors)
            const isBorder = distanceField[ny * width + nx] === 0;
            const weight = isBorder ? 
              1 / (pixelDist * pixelDist) : 
              0.5 / (pixelDist * pixelDist);
            
            const nIdx = (ny * width + nx) * 4;
            sumR += data[nIdx] * weight;
            sumG += data[nIdx + 1] * weight;
            sumB += data[nIdx + 2] * weight;
            totalWeight += weight;
          }
        }
        
        if (totalWeight > 0) {
          const pixelIdx = idx * 4;
          data[pixelIdx] = Math.round(sumR / totalWeight);
          data[pixelIdx + 1] = Math.round(sumG / totalWeight);
          data[pixelIdx + 2] = Math.round(sumB / totalWeight);
          workMask[idx] = 0;
        }
      }
    }
  }
  
  // Step 4: Add subtle texture variation to avoid flat look
  addSubtleTexture(data, mask, width, height, bounds, borderPixels);
  
  // Fill any remaining with simple average
  fillWithAverage(data, workMask, width, height, bounds);
}

/**
 * Transfer texture from nearby source areas
 * Keeps the base color from fill but adds real texture detail
 */
function addSubtleTexture(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  borderPixels: Array<{ x: number; y: number; r: number; g: number; b: number }>
): void {
  if (borderPixels.length < 5) return;
  
  // Store the smooth fill colors
  const filledColors = new Map<number, { r: number; g: number; b: number }>();
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] < 0.5) continue;
      const idx = (y * width + x) * 4;
      filledColors.set(y * width + x, {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2]
      });
    }
  }
  
  // Build a grid of source samples (outside mask, near bounds)
  const sourceSamples: Array<{ x: number; y: number; lum: number }> = [];
  const samplePad = 80;
  const sampleBounds = {
    minX: Math.max(0, bounds.minX - samplePad),
    minY: Math.max(0, bounds.minY - samplePad),
    maxX: Math.min(width - 1, bounds.maxX + samplePad),
    maxY: Math.min(height - 1, bounds.maxY + samplePad),
  };
  
  for (let y = sampleBounds.minY; y <= sampleBounds.maxY; y += 3) {
    for (let x = sampleBounds.minX; x <= sampleBounds.maxX; x += 3) {
      if (mask[y * width + x] > 0.3) continue;
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      sourceSamples.push({ x, y, lum });
    }
  }
  
  if (sourceSamples.length < 10) return;
  
  // For each filled pixel, find a source with similar luminance and copy its texture
  const textureStrength = 0.7; // How much real texture vs smooth fill
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] < 0.5) continue;
      
      const filled = filledColors.get(idx);
      if (!filled) continue;
      
      const filledLum = 0.299 * filled.r + 0.587 * filled.g + 0.114 * filled.b;
      
      // Find best matching source by luminance AND position (prefer nearby)
      let bestSource = sourceSamples[0];
      let bestScore = Infinity;
      
      // Sample random subset for speed
      const samplesToCheck = Math.min(30, sourceSamples.length);
      for (let i = 0; i < samplesToCheck; i++) {
        const s = sourceSamples[Math.floor(Math.random() * sourceSamples.length)];
        const lumDiff = Math.abs(s.lum - filledLum);
        const posDist = Math.sqrt((s.x - x) ** 2 + (s.y - y) ** 2);
        const score = lumDiff * 2 + posDist * 0.5; // Weight luminance more
        
        if (score < bestScore) {
          bestScore = score;
          bestSource = s;
        }
      }
      
      // Get the source pixel's color
      const srcIdx = (bestSource.y * width + bestSource.x) * 4;
      const srcR = data[srcIdx];
      const srcG = data[srcIdx + 1];
      const srcB = data[srcIdx + 2];
      const srcLum = 0.299 * srcR + 0.587 * srcG + 0.114 * srcB;
      
      // Transfer texture: adjust source to match fill's luminance
      const lumRatio = filledLum / (srcLum + 1);
      const adjustedR = srcR * lumRatio;
      const adjustedG = srcG * lumRatio;
      const adjustedB = srcB * lumRatio;
      
      // Blend adjusted source with smooth fill
      const pixelIdx = idx * 4;
      data[pixelIdx] = Math.max(0, Math.min(255, Math.round(
        filled.r * (1 - textureStrength) + adjustedR * textureStrength
      )));
      data[pixelIdx + 1] = Math.max(0, Math.min(255, Math.round(
        filled.g * (1 - textureStrength) + adjustedG * textureStrength
      )));
      data[pixelIdx + 2] = Math.max(0, Math.min(255, Math.round(
        filled.b * (1 - textureStrength) + adjustedB * textureStrength
      )));
    }
  }
  
  // Final smoothing pass to reduce any harsh transitions
  smoothFilledRegion(data, mask, width, bounds);
}

/**
 * Light smoothing to blend texture transitions
 */
function smoothFilledRegion(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const temp = new Uint8ClampedArray(data);
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] < 0.5) continue;
      
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      // Small 3x3 average
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < bounds.minY || ny > bounds.maxY) continue;
          
          const nIdx = (ny * width + nx) * 4;
          sumR += temp[nIdx];
          sumG += temp[nIdx + 1];
          sumB += temp[nIdx + 2];
          count++;
        }
      }
      
      if (count > 0) {
        const idx = (y * width + x) * 4;
        // Light blend - mostly keep original, slight averaging
        data[idx] = Math.round(temp[idx] * 0.6 + (sumR / count) * 0.4);
        data[idx + 1] = Math.round(temp[idx + 1] * 0.6 + (sumG / count) * 0.4);
        data[idx + 2] = Math.round(temp[idx + 2] * 0.6 + (sumB / count) * 0.4);
      }
    }
  }
}

/**
 * Fill remaining masked pixels with local average color
 */
function fillWithAverage(
  data: Uint8ClampedArray,
  mask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (mask[y * width + x] < 0.5) continue;
      
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      for (let dy = -20; dy <= 20; dy += 2) {
        for (let dx = -20; dx <= 20; dx += 2) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (mask[ny * width + nx] > 0.5) continue;
          
          const nIdx = (ny * width + nx) * 4;
          sumR += data[nIdx];
          sumG += data[nIdx + 1];
          sumB += data[nIdx + 2];
          count++;
        }
      }
      
      if (count > 0) {
        const idx = (y * width + x) * 4;
        data[idx] = Math.round(sumR / count);
        data[idx + 1] = Math.round(sumG / count);
        data[idx + 2] = Math.round(sumB / count);
      }
    }
  }
}

/**
 * Synchronous version for legacy compatibility
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  contentAwareFillWithMaskAsync(imageData, mask, bounds, options);
}

/**
 * Legacy bounding box based fill
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
