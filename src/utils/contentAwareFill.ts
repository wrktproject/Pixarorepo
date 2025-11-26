/**
 * Content-Aware Fill Implementation
 * Fast inpainting using exemplar-based synthesis
 */

export interface ContentAwareFillOptions {
  patchSize?: number;
  searchRadius?: number;
}

/**
 * Fast content-aware fill using the stroke mask
 * Uses a simplified but fast inpainting algorithm
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  const { width, height, data } = imageData;
  const { patchSize = 7, searchRadius = 100 } = options;
  const halfPatch = Math.floor(patchSize / 2);
  
  console.log('Content-aware fill:', { bounds, patchSize, searchRadius });
  
  // Get list of pixels to fill (inside mask)
  const pixelsToFill: Array<{ x: number; y: number; priority: number }> = [];
  
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x];
      if (maskWeight > 0.5) {
        // Calculate priority based on edge proximity (fill from edges inward)
        let edgeDist = Infinity;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (mask[ny * width + nx] < 0.3) {
                edgeDist = Math.min(edgeDist, Math.abs(dx) + Math.abs(dy));
              }
            }
          }
        }
        pixelsToFill.push({ x, y, priority: edgeDist });
      }
    }
  }
  
  // Sort by priority (edge pixels first)
  pixelsToFill.sort((a, b) => a.priority - b.priority);
  
  console.log(`Filling ${pixelsToFill.length} pixels...`);
  
  // Create a copy for reading while we write
  const originalData = new Uint8ClampedArray(data);
  const filled = new Set<string>();
  
  // Fill pixels from edges inward
  for (const { x, y } of pixelsToFill) {
    const key = `${x},${y}`;
    if (filled.has(key)) continue;
    
    // Find best matching patch from surrounding area
    let bestX = x;
    let bestY = y;
    let bestScore = Infinity;
    
    // Search in nearby unmasked areas
    const searchStep = Math.max(2, Math.floor(searchRadius / 20));
    
    for (let sy = Math.max(halfPatch, y - searchRadius); sy < Math.min(height - halfPatch, y + searchRadius); sy += searchStep) {
      for (let sx = Math.max(halfPatch, x - searchRadius); sx < Math.min(width - halfPatch, x + searchRadius); sx += searchStep) {
        // Skip if source is in mask
        if (mask[sy * width + sx] > 0.3) continue;
        
        // Calculate patch similarity (only using known pixels)
        let score = 0;
        let count = 0;
        
        for (let dy = -halfPatch; dy <= halfPatch; dy++) {
          for (let dx = -halfPatch; dx <= halfPatch; dx++) {
            const tx = x + dx;
            const ty = y + dy;
            const srcX = sx + dx;
            const srcY = sy + dy;
            
            if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue;
            if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) continue;
            
            // Only compare if target pixel is known (filled or outside mask)
            const targetMask = mask[ty * width + tx];
            if (targetMask < 0.3 || filled.has(`${tx},${ty}`)) {
              const tidx = (ty * width + tx) * 4;
              const sidx = (srcY * width + srcX) * 4;
              
              for (let c = 0; c < 3; c++) {
                const diff = data[tidx + c] - originalData[sidx + c];
                score += diff * diff;
              }
              count++;
            }
          }
        }
        
        if (count > 0) {
          score /= count;
          if (score < bestScore) {
            bestScore = score;
            bestX = sx;
            bestY = sy;
          }
        }
      }
    }
    
    // Copy the best matching pixel
    const targetIdx = (y * width + x) * 4;
    const sourceIdx = (bestY * width + bestX) * 4;
    
    data[targetIdx] = originalData[sourceIdx];
    data[targetIdx + 1] = originalData[sourceIdx + 1];
    data[targetIdx + 2] = originalData[sourceIdx + 2];
    
    filled.add(key);
  }
  
  // Apply simple smoothing pass for better blending
  applyEdgeSmoothing(imageData, mask, bounds);
  
  console.log('Content-aware fill complete');
}

/**
 * Smooth edges for better blending
 */
function applyEdgeSmoothing(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  const { width, data } = imageData;
  const tempData = new Uint8ClampedArray(data);
  
  // Apply 3x3 smoothing at edges
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x];
      
      // Only smooth edge pixels (0.2 < weight < 0.8)
      if (maskWeight > 0.2 && maskWeight < 0.8) {
        const targetIdx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let count = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < imageData.height) {
                sum += tempData[(ny * width + nx) * 4 + c];
                count++;
              }
            }
          }
          
          data[targetIdx + c] = Math.round(sum / count);
        }
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
