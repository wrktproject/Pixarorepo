/**
 * Content-Aware Fill Implementation
 * Fast inpainting using edge-based propagation
 */

export interface ContentAwareFillOptions {
  iterations?: number;
}

/**
 * Fast content-aware fill using edge propagation
 * Much faster than patch matching - fills from edges inward
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  const { width, height, data } = imageData;
  const { iterations = 50 } = options;
  
  const pixelCount = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
  console.log('Content-aware fill:', { bounds, pixelCount, iterations });
  
  // Create working buffer
  const buffer = new Float32Array(width * height * 3);
  
  // Initialize buffer with current image data
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      buffer[idx * 3] = data[pixelIdx];
      buffer[idx * 3 + 1] = data[pixelIdx + 1];
      buffer[idx * 3 + 2] = data[pixelIdx + 2];
    }
  }
  
  // Iterative edge propagation - fills from edges inward
  // Each iteration, masked pixels take the average of their known neighbors
  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const maskWeight = mask[y * width + x];
        if (maskWeight < 0.1) continue; // Skip unmasked pixels
        
        // Calculate weighted average of neighbors
        let sumR = 0, sumG = 0, sumB = 0;
        let totalWeight = 0;
        
        // Check 8 neighbors
        const neighbors = [
          { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
          { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
          { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
          { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
        ];
        
        for (const { dx, dy } of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const nIdx = ny * width + nx;
          const nMask = mask[nIdx];
          
          // Weight by inverse mask (known pixels have more weight)
          const weight = 1 - nMask * 0.8;
          
          sumR += buffer[nIdx * 3] * weight;
          sumG += buffer[nIdx * 3 + 1] * weight;
          sumB += buffer[nIdx * 3 + 2] * weight;
          totalWeight += weight;
        }
        
        if (totalWeight > 0) {
          const idx = y * width + x;
          const newR = sumR / totalWeight;
          const newG = sumG / totalWeight;
          const newB = sumB / totalWeight;
          
          // Blend based on iteration progress (more blending later)
          const blendFactor = Math.min(1, (iter + 1) / 10);
          buffer[idx * 3] = buffer[idx * 3] * (1 - blendFactor) + newR * blendFactor;
          buffer[idx * 3 + 1] = buffer[idx * 3 + 1] * (1 - blendFactor) + newG * blendFactor;
          buffer[idx * 3 + 2] = buffer[idx * 3 + 2] * (1 - blendFactor) + newB * blendFactor;
          changed = true;
        }
      }
    }
    
    if (!changed) break; // Converged early
  }
  
  // Apply result with mask-based blending
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const maskWeight = mask[y * width + x];
      if (maskWeight < 0.05) continue;
      
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      
      // Blend filled result with original based on mask
      data[pixelIdx] = Math.round(
        data[pixelIdx] * (1 - maskWeight) + buffer[idx * 3] * maskWeight
      );
      data[pixelIdx + 1] = Math.round(
        data[pixelIdx + 1] * (1 - maskWeight) + buffer[idx * 3 + 1] * maskWeight
      );
      data[pixelIdx + 2] = Math.round(
        data[pixelIdx + 2] * (1 - maskWeight) + buffer[idx * 3 + 2] * maskWeight
      );
    }
  }
  
  console.log('Content-aware fill complete');
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
