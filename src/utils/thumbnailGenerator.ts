/**
 * Thumbnail Generator
 * Utility for creating thumbnail images from ProcessedImage
 */

import type { ProcessedImage } from '../types/image';

export interface ThumbnailOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Generate a thumbnail data URL from a ProcessedImage
 */
export function generateThumbnail(
  image: ProcessedImage,
  options: ThumbnailOptions = {}
): string {
  const {
    maxWidth = 200,
    maxHeight = 200,
    quality = 0.8,
  } = options;

  // Calculate thumbnail dimensions maintaining aspect ratio
  const aspectRatio = image.width / image.height;
  let thumbWidth = maxWidth;
  let thumbHeight = maxHeight;

  if (aspectRatio > 1) {
    // Landscape
    thumbHeight = Math.round(thumbWidth / aspectRatio);
  } else {
    // Portrait or square
    thumbWidth = Math.round(thumbHeight * aspectRatio);
  }

  // Create canvas for thumbnail
  const canvas = document.createElement('canvas');
  canvas.width = thumbWidth;
  canvas.height = thumbHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context for thumbnail generation');
  }

  // Create temporary canvas with original image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('Failed to get 2D context for temporary canvas');
  }

  // Put original image data on temp canvas
  tempCtx.putImageData(image.data, 0, 0);

  // Draw scaled image on thumbnail canvas
  ctx.drawImage(tempCanvas, 0, 0, thumbWidth, thumbHeight);

  // Convert to data URL
  return canvas.toDataURL('image/jpeg', quality);
}
