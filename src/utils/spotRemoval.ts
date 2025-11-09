/**
 * Spot Removal Utility
 * Fast processing path for small blemish removal
 */

import type { RemovalMask } from '../types/adjustments';

const SPOT_REMOVAL_THRESHOLD = 500; // pixels
const SPOT_REMOVAL_TIMEOUT = 500; // milliseconds

/**
 * Check if mask qualifies for spot removal optimization
 */
export function isSpotRemoval(mask: RemovalMask): boolean {
  const { bounds } = mask;
  const area = bounds.width * bounds.height;
  return area < SPOT_REMOVAL_THRESHOLD;
}

/**
 * Calculate mask area (number of non-zero pixels)
 */
export function calculateMaskArea(mask: RemovalMask): number {
  let count = 0;
  for (let i = 0; i < mask.pixels.length; i++) {
    if (mask.pixels[i] > 0) {
      count++;
    }
  }
  return count;
}

/**
 * Perform fast spot removal using content-aware fill algorithm
 * This is a simplified version that uses surrounding pixels
 */
export function performSpotRemoval(
  imageData: ImageData,
  mask: RemovalMask
): ImageData {
  const { bounds, pixels } = mask;
  const { width, height, data } = imageData;
  
  // Create a copy of the image data
  const result = new ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );

  // For each pixel in the mask
  for (let y = 0; y < bounds.height; y++) {
    for (let x = 0; x < bounds.width; x++) {
      const maskIdx = y * width + x;
      const maskValue = pixels[maskIdx];

      // Skip if not masked
      if (maskValue === 0) continue;

      const imgX = bounds.x + x;
      const imgY = bounds.y + y;

      // Skip if out of bounds
      if (imgX < 0 || imgX >= width || imgY < 0 || imgY >= height) continue;

      // Sample surrounding pixels
      const samples: number[][] = [];
      const sampleRadius = 3;

      for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
          const sampleX = imgX + dx;
          const sampleY = imgY + dy;

          // Skip if out of bounds
          if (
            sampleX < 0 ||
            sampleX >= width ||
            sampleY < 0 ||
            sampleY >= height
          ) {
            continue;
          }

          // Check if sample point is masked
          const sampleMaskX = x + dx;
          const sampleMaskY = y + dy;
          
          if (
            sampleMaskX >= 0 &&
            sampleMaskX < bounds.width &&
            sampleMaskY >= 0 &&
            sampleMaskY < bounds.height
          ) {
            const sampleMaskIdx = sampleMaskY * width + sampleMaskX;
            if (sampleMaskIdx < pixels.length && pixels[sampleMaskIdx] > 0) {
              continue; // Skip masked pixels
            }
          }

          // Get pixel color
          const sampleIdx = (sampleY * width + sampleX) * 4;
          samples.push([
            data[sampleIdx],     // R
            data[sampleIdx + 1], // G
            data[sampleIdx + 2], // B
            data[sampleIdx + 3], // A
          ]);
        }
      }

      // Calculate average color from samples
      if (samples.length > 0) {
        const avgColor = [0, 0, 0, 0];
        for (const sample of samples) {
          avgColor[0] += sample[0];
          avgColor[1] += sample[1];
          avgColor[2] += sample[2];
          avgColor[3] += sample[3];
        }
        avgColor[0] = Math.round(avgColor[0] / samples.length);
        avgColor[1] = Math.round(avgColor[1] / samples.length);
        avgColor[2] = Math.round(avgColor[2] / samples.length);
        avgColor[3] = Math.round(avgColor[3] / samples.length);

        // Apply blended color based on mask value
        const resultIdx = (imgY * width + imgX) * 4;
        const alpha = maskValue / 255;

        result.data[resultIdx] = Math.round(
          data[resultIdx] * (1 - alpha) + avgColor[0] * alpha
        );
        result.data[resultIdx + 1] = Math.round(
          data[resultIdx + 1] * (1 - alpha) + avgColor[1] * alpha
        );
        result.data[resultIdx + 2] = Math.round(
          data[resultIdx + 2] * (1 - alpha) + avgColor[2] * alpha
        );
        result.data[resultIdx + 3] = data[resultIdx + 3]; // Keep original alpha
      }
    }
  }

  return result;
}

/**
 * Perform spot removal with timeout
 */
export async function performSpotRemovalAsync(
  imageData: ImageData,
  mask: RemovalMask,
  timeout: number = SPOT_REMOVAL_TIMEOUT
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Spot removal timeout exceeded'));
    }, timeout);

    try {
      const result = performSpotRemoval(imageData, mask);
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Get recommended timeout for mask size
 */
export function getRecommendedTimeout(mask: RemovalMask): number {
  const area = calculateMaskArea(mask);
  
  if (area < SPOT_REMOVAL_THRESHOLD) {
    return SPOT_REMOVAL_TIMEOUT;
  }
  
  // Scale timeout based on area (5 seconds max)
  return Math.min(5000, Math.max(500, area * 2));
}
