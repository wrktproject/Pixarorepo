/**
 * Content-Aware Fill Implementation
 * Exemplar-based inpainting - copies texture patches from outside the mask
 */

export interface ContentAwareFillOptions {
  patchSize?: number;
  searchRadius?: number;
}

/**
 * Fast exemplar-based content-aware fill
 * Fills masked region by finding and copying similar patches from unmasked areas
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  const { width, height, data } = imageData;
  const { patchSize = 9, searchRadius = 150 } = options;
  
  const halfPatch = Math.floor(patchSize / 2);
  
  console.log('Content-aware fill starting:', { 
    bounds, 
    patchSize, 
    searchRadius,
    maskArea: (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  });
  
  // Create a copy of the image to work with
  const filled = new Uint8ClampedArray(data);
  const filledMask = new Float32Array(mask);
  
  // Find boundary pixels (masked pixels next to unmasked ones)
  function getBoundaryPixels(): Array<{x: number, y: number, priority: number}> {
    const boundary: Array<{x: number, y: number, priority: number}> = [];
    
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const idx = y * width + x;
        if (filledMask[idx] < 0.5) continue; // Not masked
        
        // Check if on boundary (has unmasked neighbor)
        let hasUnmaskedNeighbor = false;
        let gradientStrength = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            
            const nIdx = ny * width + nx;
            if (filledMask[nIdx] < 0.5) {
              hasUnmaskedNeighbor = true;
              // Calculate gradient for priority (prefer edges)
              const pIdx = idx * 4;
              const npIdx = nIdx * 4;
              gradientStrength += Math.abs(filled[pIdx] - filled[npIdx]);
              gradientStrength += Math.abs(filled[pIdx + 1] - filled[npIdx + 1]);
              gradientStrength += Math.abs(filled[pIdx + 2] - filled[npIdx + 2]);
            }
          }
        }
        
        if (hasUnmaskedNeighbor) {
          boundary.push({ x, y, priority: gradientStrength });
        }
      }
    }
    
    // Sort by priority (higher gradient = fill first to preserve edges)
    boundary.sort((a, b) => b.priority - a.priority);
    return boundary;
  }
  
  // Get patch from image at position
  function getPatch(px: number, py: number, useFilledMask: boolean): { colors: number[], validCount: number } {
    const colors: number[] = [];
    let validCount = 0;
    
    for (let dy = -halfPatch; dy <= halfPatch; dy++) {
      for (let dx = -halfPatch; dx <= halfPatch; dx++) {
        const x = px + dx;
        const y = py + dy;
        
        if (x < 0 || x >= width || y < 0 || y >= height) {
          colors.push(-1, -1, -1); // Invalid
          continue;
        }
        
        const idx = y * width + x;
        const pixelIdx = idx * 4;
        
        if (useFilledMask && filledMask[idx] >= 0.5) {
          colors.push(-1, -1, -1); // Masked pixel
          continue;
        }
        
        colors.push(filled[pixelIdx], filled[pixelIdx + 1], filled[pixelIdx + 2]);
        validCount++;
      }
    }
    
    return { colors, validCount };
  }
  
  // Find best matching patch from outside the mask
  function findBestPatch(targetX: number, targetY: number): { x: number, y: number } | null {
    const targetPatch = getPatch(targetX, targetY, true);
    if (targetPatch.validCount < patchSize) return null; // Not enough context
    
    let bestMatch: { x: number, y: number } | null = null;
    let bestScore = Infinity;
    
    // Search in expanded area around the mask
    const searchMinX = Math.max(halfPatch, bounds.minX - searchRadius);
    const searchMaxX = Math.min(width - halfPatch - 1, bounds.maxX + searchRadius);
    const searchMinY = Math.max(halfPatch, bounds.minY - searchRadius);
    const searchMaxY = Math.min(height - halfPatch - 1, bounds.maxY + searchRadius);
    
    // Sample search locations (don't check every pixel for speed)
    const step = Math.max(1, Math.floor(patchSize / 3));
    
    for (let sy = searchMinY; sy <= searchMaxY; sy += step) {
      for (let sx = searchMinX; sx <= searchMaxX; sx += step) {
        // Skip if this patch overlaps with mask
        const centerIdx = sy * width + sx;
        if (filledMask[centerIdx] >= 0.5) continue;
        
        // Check if patch is fully outside mask
        let overlapsMask = false;
        for (let dy = -halfPatch; dy <= halfPatch && !overlapsMask; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch && !overlapsMask; dx++) {
            const checkIdx = (sy + dy) * width + (sx + dx);
            if (filledMask[checkIdx] >= 0.5) overlapsMask = true;
          }
        }
        if (overlapsMask) continue;
        
        // Compare patches
        const sourcePatch = getPatch(sx, sy, false);
        let score = 0;
        let compared = 0;
        
        for (let i = 0; i < targetPatch.colors.length; i += 3) {
          if (targetPatch.colors[i] < 0 || sourcePatch.colors[i] < 0) continue;
          
          const dr = targetPatch.colors[i] - sourcePatch.colors[i];
          const dg = targetPatch.colors[i + 1] - sourcePatch.colors[i + 1];
          const db = targetPatch.colors[i + 2] - sourcePatch.colors[i + 2];
          score += dr * dr + dg * dg + db * db;
          compared++;
        }
        
        if (compared > 0) {
          score /= compared;
          if (score < bestScore) {
            bestScore = score;
            bestMatch = { x: sx, y: sy };
          }
        }
      }
    }
    
    return bestMatch;
  }
  
  // Fill pixel from best matching patch
  function fillFromPatch(targetX: number, targetY: number, sourceX: number, sourceY: number): void {
    const idx = targetY * width + targetX;
    const pixelIdx = idx * 4;
    
    const srcIdx = sourceY * width + sourceX;
    const srcPixelIdx = srcIdx * 4;
    
    filled[pixelIdx] = filled[srcPixelIdx];
    filled[pixelIdx + 1] = filled[srcPixelIdx + 1];
    filled[pixelIdx + 2] = filled[srcPixelIdx + 2];
    filledMask[idx] = 0; // Mark as filled
  }
  
  // Main fill loop - process boundary pixels iteratively
  let iterations = 0;
  const maxIterations = 500000; // Safety limit
  
  while (iterations < maxIterations) {
    const boundary = getBoundaryPixels();
    if (boundary.length === 0) break;
    
    // Process top priority boundary pixels
    const toProcess = boundary.slice(0, Math.max(1, Math.floor(boundary.length / 10)));
    let anyFilled = false;
    
    for (const { x, y } of toProcess) {
      const best = findBestPatch(x, y);
      if (best) {
        fillFromPatch(x, y, best.x, best.y);
        anyFilled = true;
      } else {
        // Fallback: use nearest unmasked neighbor
        for (let r = 1; r <= 10; r++) {
          let found = false;
          for (let dy = -r; dy <= r && !found; dy++) {
            for (let dx = -r; dx <= r && !found; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
              const nIdx = ny * width + nx;
              if (filledMask[nIdx] < 0.5) {
                fillFromPatch(x, y, nx, ny);
                anyFilled = true;
                found = true;
              }
            }
          }
          if (found) break;
        }
      }
    }
    
    if (!anyFilled) break;
    iterations += toProcess.length;
    
    // Progress logging every 10000 pixels
    if (iterations % 10000 === 0) {
      console.log(`Content-aware fill progress: ${iterations} pixels filled`);
    }
  }
  
  console.log(`Content-aware fill: ${iterations} pixels processed`);
  
  // Apply edge smoothing
  smoothEdges(filled, mask, width, height, bounds);
  
  // Copy result back to image data
  for (let i = 0; i < data.length; i++) {
    data[i] = filled[i];
  }
  
  console.log('Content-aware fill complete');
}

/**
 * Smooth the edges where filled region meets original image
 */
function smoothEdges(
  data: Uint8ClampedArray,
  originalMask: Float32Array,
  width: number,
  height: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const temp = new Uint8ClampedArray(data);
  const blurRadius = 2;
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      const maskVal = originalMask[idx];
      
      // Only smooth edge pixels (mask between 0.1 and 0.9)
      if (maskVal < 0.1 || maskVal > 0.9) continue;
      
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const nPixelIdx = (ny * width + nx) * 4;
          sumR += temp[nPixelIdx];
          sumG += temp[nPixelIdx + 1];
          sumB += temp[nPixelIdx + 2];
          count++;
        }
      }
      
      if (count > 0) {
        const pixelIdx = idx * 4;
        const blend = 0.5; // Blend factor for edge smoothing
        data[pixelIdx] = Math.round(temp[pixelIdx] * (1 - blend) + (sumR / count) * blend);
        data[pixelIdx + 1] = Math.round(temp[pixelIdx + 1] * (1 - blend) + (sumG / count) * blend);
        data[pixelIdx + 2] = Math.round(temp[pixelIdx + 2] * (1 - blend) + (sumB / count) * blend);
      }
    }
  }
}

/**
 * Legacy content-aware fill (bounding box based) - kept for compatibility
 */
export function contentAwareFill(
  imageData: ImageData,
  maskRegion: { x: number; y: number; width: number; height: number }
): void {
  const { width, height } = imageData;
  
  // Create Float32Array mask from bounding box
  const mask = new Float32Array(width * height);
  
  for (let y = 0; y < height; y++) {
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
    maxY: Math.min(height - 1, maskRegion.y + maskRegion.height),
  };
  
  contentAwareFillWithMask(imageData, mask, bounds);
}
