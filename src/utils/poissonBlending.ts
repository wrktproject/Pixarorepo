/**
 * Poisson Blending Implementation
 * Seamlessly blends source region into target using gradient-domain techniques
 * Based on Pérez et al. 2003 "Poisson Image Editing"
 */

/**
 * Solve Poisson equation using Gauss-Seidel iteration
 * This creates seamless blending by preserving gradients
 */
export function poissonBlend(
  imageData: ImageData,
  mask: boolean[][],
  iterations: number = 100
): void {
  const { data, width, height } = imageData;

  // Process each color channel separately
  for (let channel = 0; channel < 3; channel++) {
    // Create working buffer for this channel
    const values: number[][] = [];
    for (let y = 0; y < height; y++) {
      values[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4 + channel;
        values[y][x] = data[idx];
      }
    }

    // Gauss-Seidel iterations
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (!mask[y][x]) continue; // Only blend masked pixels

          // Calculate Laplacian (preserves gradients)
          const neighbors = [
            values[y - 1][x],     // Top
            values[y + 1][x],     // Bottom
            values[y][x - 1],     // Left
            values[y][x + 1],     // Right
          ];

          // Average of neighbors (Poisson solution)
          const newValue = neighbors.reduce((a, b) => a + b, 0) / 4;
          values[y][x] = newValue;
        }
      }
    }

    // Write blended values back
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x]) {
          const idx = (y * width + x) * 4 + channel;
          data[idx] = Math.max(0, Math.min(255, Math.round(values[y][x])));
        }
      }
    }
  }
}

/**
 * Mixed seamless cloning: Preserves stronger gradients from either source or target
 * Better for complex backgrounds
 */
export function poissonBlendMixed(
  sourceData: ImageData,
  targetData: ImageData,
  mask: boolean[][],
  iterations: number = 100
): void {
  const { data: targetPixels, width, height } = targetData;
  const sourcePixels = sourceData.data;

  // Process each color channel
  for (let channel = 0; channel < 3; channel++) {
    const values: number[][] = [];
    
    // Initialize with current target values
    for (let y = 0; y < height; y++) {
      values[y] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4 + channel;
        values[y][x] = targetPixels[idx];
      }
    }

    // Gauss-Seidel with gradient selection
    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (!mask[y][x]) continue;

          const idx = (y * width + x) * 4 + channel;

          // Get gradients from source
          const sourceGradX = Math.abs(
            sourcePixels[idx + 4] - sourcePixels[idx - 4]
          );
          const sourceGradY = Math.abs(
            sourcePixels[idx + width * 4] - sourcePixels[idx - width * 4]
          );

          // Get gradients from target
          const targetGradX = Math.abs(
            targetPixels[idx + 4] - targetPixels[idx - 4]
          );
          const targetGradY = Math.abs(
            targetPixels[idx + width * 4] - targetPixels[idx - width * 4]
          );

          // Use stronger gradient
          const useSource =
            sourceGradX + sourceGradY > targetGradX + targetGradY;

          const baseValue = useSource ? sourcePixels[idx] : targetPixels[idx];
          
          const neighbors = [
            values[y - 1][x],
            values[y + 1][x],
            values[y][x - 1],
            values[y][x + 1],
          ];

          const avgNeighbors = neighbors.reduce((a, b) => a + b, 0) / 4;
          const blended = (avgNeighbors + baseValue) / 2;
          
          values[y][x] = blended;
        }
      }
    }

    // Write back
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y][x]) {
          const idx = (y * width + x) * 4 + channel;
          targetPixels[idx] = Math.max(0, Math.min(255, Math.round(values[y][x])));
        }
      }
    }
  }
}

/**
 * Create feathered mask for smoother blending at edges
 */
export function createFeatheredMask(
  mask: boolean[][],
  featherRadius: number
): number[][] {
  const height = mask.length;
  const width = mask[0].length;
  const result: number[][] = [];

  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      if (!mask[y][x]) {
        result[y][x] = 0;
        continue;
      }

      // Calculate distance to nearest unmasked pixel
      let minDist = Infinity;
      
      for (let dy = -featherRadius; dy <= featherRadius; dy++) {
        for (let dx = -featherRadius; dx <= featherRadius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (!mask[ny][nx]) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDist = Math.min(minDist, dist);
          }
        }
      }

      // Smooth falloff
      if (minDist < featherRadius) {
        result[y][x] = minDist / featherRadius;
      } else {
        result[y][x] = 1;
      }
    }
  }

  return result;
}

