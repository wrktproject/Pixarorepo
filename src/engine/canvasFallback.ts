/**
 * Canvas Fallback Renderer
 * Provides Canvas 2D API-based image processing when WebGL is unavailable
 */

import type { AdjustmentState } from '../types';

export class CanvasFallbackRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    });
    
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    
    this.ctx = ctx;
  }

  /**
   * Render image with adjustments using Canvas 2D API
   * Note: This is a simplified fallback with reduced quality compared to WebGL
   * Requirement 10.4: Provide Canvas 2D fallback for basic adjustments
   */
  public render(imageData: ImageData, adjustments: AdjustmentState): void {
    // Set canvas size to match image
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;

    // Create a copy of the image data to work with
    const data = new Uint8ClampedArray(imageData.data);
    const pixels = data.length / 4;

    // Apply basic adjustments pixel by pixel
    for (let i = 0; i < pixels; i++) {
      const offset = i * 4;
      let r = data[offset];
      let g = data[offset + 1];
      let b = data[offset + 2];

      // Convert to 0-1 range for calculations
      r /= 255;
      g /= 255;
      b /= 255;

      // Apply exposure (photographic stops)
      const exposureFactor = Math.pow(2, adjustments.exposure);
      r *= exposureFactor;
      g *= exposureFactor;
      b *= exposureFactor;

      // Apply highlights and shadows (simplified)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      
      if (adjustments.highlights !== 0) {
        const highlightMask = Math.max(0, Math.min(1, (lum - 0.5) / 0.3));
        const highlightAdjust = 1 + (adjustments.highlights / 100) * highlightMask;
        r *= highlightAdjust;
        g *= highlightAdjust;
        b *= highlightAdjust;
      }

      if (adjustments.shadows !== 0) {
        const shadowMask = Math.max(0, Math.min(1, (0.5 - lum) / 0.3));
        const shadowAdjust = 1 + (adjustments.shadows / 100) * shadowMask;
        r *= shadowAdjust;
        g *= shadowAdjust;
        b *= shadowAdjust;
      }

      // Apply contrast
      if (adjustments.contrast !== 0) {
        const contrastFactor = 1 + adjustments.contrast / 100;
        r = (r - 0.5) * contrastFactor + 0.5;
        g = (g - 0.5) * contrastFactor + 0.5;
        b = (b - 0.5) * contrastFactor + 0.5;
      }

      // Apply temperature (simplified warm/cool shift)
      if (adjustments.temperature !== 6500) {
        const tempShift = (adjustments.temperature - 6500) / 10000;
        if (tempShift > 0) {
          // Warm
          r *= 1 + tempShift * 0.1;
          b *= 1 - tempShift * 0.1;
        } else {
          // Cool
          r *= 1 + tempShift * 0.1;
          b *= 1 - tempShift * 0.1;
        }
      }

      // Apply saturation
      if (adjustments.saturation !== 0) {
        const saturationFactor = 1 + adjustments.saturation / 100;
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = gray + (r - gray) * saturationFactor;
        g = gray + (g - gray) * saturationFactor;
        b = gray + (b - gray) * saturationFactor;
      }

      // Apply vibrance (simplified - boost low saturation colors)
      if (adjustments.vibrance !== 0) {
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const currentSat = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
        const vibranceFactor = 1 + (adjustments.vibrance / 100) * (1 - currentSat);
        r = gray + (r - gray) * vibranceFactor;
        g = gray + (g - gray) * vibranceFactor;
        b = gray + (b - gray) * vibranceFactor;
      }

      // Clamp values to 0-1 range
      r = Math.max(0, Math.min(1, r));
      g = Math.max(0, Math.min(1, g));
      b = Math.max(0, Math.min(1, b));

      // Convert back to 0-255 range
      data[offset] = Math.round(r * 255);
      data[offset + 1] = Math.round(g * 255);
      data[offset + 2] = Math.round(b * 255);
    }

    // Put the processed image data back
    const processedImageData = new ImageData(data, imageData.width, imageData.height);
    this.ctx.putImageData(processedImageData, 0, 0);

    // Apply Canvas 2D filters for additional effects (if supported)
    this.applyCanvasFilters(adjustments);
  }

  /**
   * Apply Canvas 2D filter effects
   * Uses CSS filters for additional adjustments
   */
  private applyCanvasFilters(adjustments: AdjustmentState): void {
    const filters: string[] = [];

    // Sharpening (using contrast as approximation)
    if (adjustments.sharpening > 0) {
      const sharpenAmount = 1 + adjustments.sharpening / 150;
      filters.push(`contrast(${sharpenAmount})`);
    }

    // Apply filters if any
    if (filters.length > 0) {
      this.ctx.filter = filters.join(' ');
      // Re-draw to apply filters
      const tempImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.putImageData(tempImageData, 0, 0);
      this.ctx.filter = 'none';
    }
  }

  /**
   * Clear the canvas
   */
  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get the current canvas image data
   */
  public getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clear();
  }
}
