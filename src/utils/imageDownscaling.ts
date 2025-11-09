/**
 * Image Downscaling Utilities
 * Handles downscaling images for preview rendering
 */

export interface DownscaleConfig {
  maxSize: number;
  quality?: 'high' | 'medium' | 'low';
}

export interface DownscaleResult {
  imageData: ImageData;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
  scale: number;
}

/**
 * Calculate preview dimensions maintaining aspect ratio
 */
export function calculatePreviewSize(
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number; scale: number } {
  if (width <= maxSize && height <= maxSize) {
    return { width, height, scale: 1 };
  }

  const aspectRatio = width / height;
  let previewWidth: number;
  let previewHeight: number;

  if (width > height) {
    previewWidth = maxSize;
    previewHeight = Math.round(maxSize / aspectRatio);
  } else {
    previewHeight = maxSize;
    previewWidth = Math.round(maxSize * aspectRatio);
  }

  const scale = previewWidth / width;

  return { width: previewWidth, height: previewHeight, scale };
}

/**
 * Downscale ImageData using high-quality canvas rendering
 */
export function downscaleImageData(
  imageData: ImageData,
  config: DownscaleConfig
): DownscaleResult {
  const { maxSize, quality = 'high' } = config;
  const { width: originalWidth, height: originalHeight } = imageData;

  const { width: previewWidth, height: previewHeight, scale } = calculatePreviewSize(
    originalWidth,
    originalHeight,
    maxSize
  );

  // If no downscaling needed, return original
  if (scale === 1) {
    return {
      imageData,
      originalWidth,
      originalHeight,
      previewWidth,
      previewHeight,
      scale,
    };
  }

  // Create canvas for downscaling
  const canvas = document.createElement('canvas');
  canvas.width = previewWidth;
  canvas.height = previewHeight;
  const ctx = canvas.getContext('2d', { alpha: true });

  if (!ctx) {
    throw new Error('Failed to get 2D context for downscaling');
  }

  // Set image smoothing quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = quality;

  // Draw original image scaled down
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = originalWidth;
  tempCanvas.height = originalHeight;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('Failed to get 2D context for temp canvas');
  }

  tempCtx.putImageData(imageData, 0, 0);

  // Use multi-step downscaling for better quality if scale is very small
  if (quality === 'high' && scale < 0.5) {
    downscaleMultiStep(tempCanvas, canvas, ctx, previewWidth, previewHeight);
  } else {
    ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);
  }

  const downscaledImageData = ctx.getImageData(0, 0, previewWidth, previewHeight);

  return {
    imageData: downscaledImageData,
    originalWidth,
    originalHeight,
    previewWidth,
    previewHeight,
    scale,
  };
}

/**
 * Multi-step downscaling for better quality
 * Downscales in steps of 50% until reaching target size
 */
function downscaleMultiStep(
  sourceCanvas: HTMLCanvasElement,
  _targetCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number
): void {
  let currentCanvas = sourceCanvas;
  let currentWidth = sourceCanvas.width;
  let currentHeight = sourceCanvas.height;

  // Downscale in steps of 50% until we're close to target
  while (currentWidth > targetWidth * 2 || currentHeight > targetHeight * 2) {
    const stepWidth = Math.max(Math.floor(currentWidth / 2), targetWidth);
    const stepHeight = Math.max(Math.floor(currentHeight / 2), targetHeight);

    const stepCanvas = document.createElement('canvas');
    stepCanvas.width = stepWidth;
    stepCanvas.height = stepHeight;
    const stepCtx = stepCanvas.getContext('2d');

    if (!stepCtx) {
      break;
    }

    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentCanvas, 0, 0, stepWidth, stepHeight);

    currentCanvas = stepCanvas;
    currentWidth = stepWidth;
    currentHeight = stepHeight;
  }

  // Final step to exact target size
  targetCtx.drawImage(currentCanvas, 0, 0, targetWidth, targetHeight);
}

/**
 * Upscale ImageData back to original size (for export)
 */
export function upscaleImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context for upscaling');
  }

  // Create temp canvas with source image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('Failed to get 2D context for temp canvas');
  }

  tempCtx.putImageData(imageData, 0, 0);

  // Upscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}
