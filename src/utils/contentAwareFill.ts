/**
 * Content-Aware Fill Implementation
 * 
 * Uses server-side AI inpainting for best quality results.
 * If the AI server is unavailable, the operation fails gracefully.
 */

import { tryServerInpaint, isServerInpaintingAvailable } from './serverInpainting';

export interface ContentAwareFillOptions {
  onProgress?: (status: string) => void;
}

/**
 * Main content-aware fill function
 * Uses server-side AI only - no local fallback
 */
export async function contentAwareFillWithMaskAsync(
  imageData: ImageData,
  mask: Float32Array,
  _bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): Promise<void> {
  const { onProgress } = options;
  const { width, height, data } = imageData;
  
  // Check if server is available
  if (!isServerInpaintingAvailable()) {
    throw new Error('AI removal is not available. Please try again later.');
  }
  
  onProgress?.('Sending to AI for processing...');
  console.log('Attempting server-side AI inpainting...');
  
  const result = await tryServerInpaint(imageData, mask, onProgress);
  
  if (!result) {
    throw new Error('AI removal failed. Please try again.');
  }
  
  // Copy result back to original imageData
  console.log('Server inpainting successful!');
  onProgress?.('Applying AI result...');
  
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
  
  console.log('Content-aware fill complete');
}

/**
 * Synchronous version for legacy compatibility (just calls async)
 */
export function contentAwareFillWithMask(
  imageData: ImageData,
  mask: Float32Array,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  options: ContentAwareFillOptions = {}
): void {
  // Note: This won't wait for the async operation
  contentAwareFillWithMaskAsync(imageData, mask, bounds, options);
}

/**
 * Legacy bounding box based fill (for backwards compatibility)
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
