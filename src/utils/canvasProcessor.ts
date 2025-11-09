/**
 * Canvas Processor
 * Applies adjustments using Canvas API for export (non-WebGL fallback)
 */

import type { AdjustmentState } from '../types/adjustments';

/**
 * Apply all adjustments to image data using Canvas API
 * This is used for export to ensure full resolution processing
 */
export function applyAdjustmentsToImageData(
  imageData: ImageData,
  adjustments: AdjustmentState
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  // Put original image data
  ctx.putImageData(imageData, 0, 0);

  // Apply geometric transformations first
  if (adjustments.crop || adjustments.straighten !== 0) {
    applyGeometricTransforms(ctx, canvas, adjustments);
  }

  // Get current image data after geometric transforms
  let currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Apply pixel-level adjustments
  currentData = applyPixelAdjustments(currentData, adjustments);

  // Put back the adjusted data
  ctx.putImageData(currentData, 0, 0);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Apply geometric transformations (crop and rotation)
 */
function applyGeometricTransforms(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  adjustments: AdjustmentState
): void {
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;

  // Save current state
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = originalWidth;
  tempCanvas.height = originalHeight;
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('Failed to get temp 2D context');
  }

  tempCtx.drawImage(canvas, 0, 0);

  // Apply rotation if needed
  if (adjustments.straighten !== 0) {
    const angleRad = (adjustments.straighten * Math.PI) / 180;

    // Calculate new canvas size to fit rotated image
    const cos = Math.abs(Math.cos(angleRad));
    const sin = Math.abs(Math.sin(angleRad));
    const newWidth = originalWidth * cos + originalHeight * sin;
    const newHeight = originalWidth * sin + originalHeight * cos;

    canvas.width = Math.ceil(newWidth);
    canvas.height = Math.ceil(newHeight);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angleRad);
    ctx.drawImage(tempCanvas, -originalWidth / 2, -originalHeight / 2);
    ctx.restore();

    // Update temp canvas with rotated image
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
  }

  // Apply crop if needed
  if (adjustments.crop) {
    const crop = adjustments.crop;
    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      tempCanvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
  }
}

/**
 * Apply pixel-level adjustments (tonal, color, effects)
 */
function applyPixelAdjustments(
  imageData: ImageData,
  adjustments: AdjustmentState
): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    // Convert to linear color space
    r = sRGBToLinear(r);
    g = sRGBToLinear(g);
    b = sRGBToLinear(b);

    // Apply tonal adjustments
    [r, g, b] = applyTonalAdjustments(r, g, b, adjustments);

    // Apply color adjustments
    [r, g, b] = applyColorAdjustments(r, g, b, adjustments);

    // Apply effects (vignette, grain)
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    [r, g, b] = applyEffects(r, g, b, x, y, width, height, adjustments);

    // Convert back to sRGB
    r = linearToSRGB(r);
    g = linearToSRGB(g);
    b = linearToSRGB(b);

    // Clamp and write back
    data[i] = Math.max(0, Math.min(255, r * 255));
    data[i + 1] = Math.max(0, Math.min(255, g * 255));
    data[i + 2] = Math.max(0, Math.min(255, b * 255));
  }

  return imageData;
}

/**
 * Apply tonal adjustments (exposure, contrast, etc.)
 */
function applyTonalAdjustments(
  r: number,
  g: number,
  b: number,
  adjustments: AdjustmentState
): [number, number, number] {
  // Apply exposure
  const exposureFactor = Math.pow(2, adjustments.exposure);
  r *= exposureFactor;
  g *= exposureFactor;
  b *= exposureFactor;

  // Apply contrast
  const contrastFactor = (adjustments.contrast + 100) / 100;
  r = (r - 0.5) * contrastFactor + 0.5;
  g = (g - 0.5) * contrastFactor + 0.5;
  b = (b - 0.5) * contrastFactor + 0.5;

  // Calculate luminance for highlights/shadows
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Apply highlights (affects bright areas)
  if (lum > 0.5) {
    const highlightFactor = 1 + (adjustments.highlights / 100) * (lum - 0.5) * 2;
    r *= highlightFactor;
    g *= highlightFactor;
    b *= highlightFactor;
  }

  // Apply shadows (affects dark areas)
  if (lum < 0.5) {
    const shadowFactor = 1 + (adjustments.shadows / 100) * (0.5 - lum) * 2;
    r *= shadowFactor;
    g *= shadowFactor;
    b *= shadowFactor;
  }

  // Apply whites (affects very bright areas)
  if (lum > 0.7) {
    const whitesFactor = 1 + (adjustments.whites / 100) * (lum - 0.7) * 3.33;
    r *= whitesFactor;
    g *= whitesFactor;
    b *= whitesFactor;
  }

  // Apply blacks (affects very dark areas)
  if (lum < 0.3) {
    const blacksFactor = 1 + (adjustments.blacks / 100) * (0.3 - lum) * 3.33;
    r *= blacksFactor;
    g *= blacksFactor;
    b *= blacksFactor;
  }

  return [r, g, b];
}

/**
 * Apply color adjustments (temperature, tint, saturation, vibrance)
 */
function applyColorAdjustments(
  r: number,
  g: number,
  b: number,
  adjustments: AdjustmentState
): [number, number, number] {
  // Apply temperature (simplified Kelvin to RGB conversion)
  const tempFactor = (adjustments.temperature - 6500) / 10000;
  r *= 1 + tempFactor * 0.3;
  b *= 1 - tempFactor * 0.3;

  // Apply tint (green-magenta shift)
  const tintFactor = adjustments.tint / 150;
  g *= 1 + tintFactor * 0.2;

  // Apply saturation
  const satFactor = (adjustments.saturation + 100) / 100;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = lum + (r - lum) * satFactor;
  g = lum + (g - lum) * satFactor;
  b = lum + (b - lum) * satFactor;

  // Apply vibrance (selective saturation boost for less saturated colors)
  if (adjustments.vibrance !== 0) {
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const currentSat = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;

    if (currentSat < 0.5) {
      const vibranceFactor = 1 + (adjustments.vibrance / 100) * (1 - currentSat);
      r = lum + (r - lum) * vibranceFactor;
      g = lum + (g - lum) * vibranceFactor;
      b = lum + (b - lum) * vibranceFactor;
    }
  }

  return [r, g, b];
}

/**
 * Apply effects (vignette, grain)
 */
function applyEffects(
  r: number,
  g: number,
  b: number,
  x: number,
  y: number,
  width: number,
  height: number,
  adjustments: AdjustmentState
): [number, number, number] {
  // Apply vignette
  if (adjustments.vignette.amount !== 0) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    const dist = Math.sqrt(
      Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
    );

    const midpoint = adjustments.vignette.midpoint / 100;
    const feather = Math.max(0.01, adjustments.vignette.feather / 100);
    const amount = adjustments.vignette.amount / 100;

    const normalizedDist = dist / maxDist;
    const vignetteFactor =
      1 -
      amount *
        Math.pow(
          Math.max(0, (normalizedDist - midpoint) / feather),
          2
        );

    r *= vignetteFactor;
    g *= vignetteFactor;
    b *= vignetteFactor;
  }

  // Apply grain (simplified noise)
  if (adjustments.grain.amount > 0) {
    const grainAmount = adjustments.grain.amount / 100;
    const grainSize = adjustments.grain.size === 'fine' ? 1 : adjustments.grain.size === 'medium' ? 2 : 3;

    // Simple pseudo-random noise based on position
    const noise = (Math.sin(x * 12.9898 + y * 78.233 * grainSize) * 43758.5453) % 1;
    const grainValue = (noise - 0.5) * grainAmount * 0.1;

    r += grainValue;
    g += grainValue;
    b += grainValue;
  }

  return [r, g, b];
}

/**
 * Convert sRGB to linear color space
 */
function sRGBToLinear(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear to sRGB color space
 */
function linearToSRGB(value: number): number {
  if (value <= 0.0031308) {
    return value * 12.92;
  }
  return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}
