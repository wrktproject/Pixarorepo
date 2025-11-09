/**
 * Export Processor
 * Manages full-resolution export with high-quality WebGL rendering
 * Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { ExportSettings } from '../types/components';
import type { AdjustmentState } from '../types/adjustments';
import type { ProcessedImage, ImageMetadata } from '../types/store';
import { ExportRenderer } from '../engine/exportRenderer';

export interface ExportProgress {
  stage: 'processing' | 'encoding' | 'complete';
  progress: number; // 0-100
}

export class ExportProcessor {
  private renderer: ExportRenderer | null = null;
  private progressCallback: ((progress: ExportProgress) => void) | null = null;
  private aborted = false;

  /**
   * Export image with full resolution and all adjustments applied
   * Uses high-quality WebGL rendering with quality preservation
   * Requirements 14.1, 14.2, 14.3, 14.4, 14.5
   */
  public async exportImage(
    originalImage: ProcessedImage,
    adjustments: AdjustmentState,
    settings: ExportSettings,
    metadata: ImageMetadata | null,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<Blob> {
    this.progressCallback = onProgress || null;
    this.aborted = false;

    try {
      // Report processing stage
      this.reportProgress('processing', 10);

      // Scale image if needed
      const scaledImageData = this.scaleImageData(
        originalImage.data,
        settings.width,
        settings.height
      );

      if (this.aborted) {
        throw new Error('Export cancelled');
      }

      // Apply adjustments using high-quality WebGL renderer
      // Requirements:
      // - 14.1: Use 16-bit float textures for all processing
      // - 14.2: Render at full resolution during export
      // - 14.3: Add dithering when converting to 8-bit
      // - 14.4: Preserve dynamic range of RAW images
      // - 14.5: Minimize color space conversions
      this.reportProgress('processing', 30);
      const processedImageData = await this.applyAdjustmentsWithWebGL(
        scaledImageData,
        adjustments
      );

      if (this.aborted) {
        throw new Error('Export cancelled');
      }

      // Report encoding stage
      this.reportProgress('encoding', 70);

      // Encode to desired format
      const blob = await this.encodeImage(
        processedImageData,
        settings,
        metadata
      );

      // Report complete
      this.reportProgress('complete', 100);

      return blob;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Scale image data to target dimensions
   */
  private scaleImageData(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number
  ): ImageData {
    // If dimensions match, return original
    if (imageData.width === targetWidth && imageData.height === targetHeight) {
      return imageData;
    }

    // Create canvas for scaling
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context for scaling');
    }

    // Draw original image scaled
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Failed to get temp 2D context');
    }

    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);

    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  /**
   * Apply adjustments using high-quality WebGL renderer
   * Requirements 14.1, 14.2, 14.3, 14.4, 14.5
   */
  private async applyAdjustmentsWithWebGL(
    imageData: ImageData,
    adjustments: AdjustmentState
  ): Promise<ImageData> {
    try {
      // Create renderer if needed
      if (!this.renderer) {
        this.renderer = new ExportRenderer();
      }

      // Render with high quality settings
      // - 14.1: Uses 16-bit float textures internally
      // - 14.2: Renders at full resolution
      // - 14.3: Applies dithering when converting to 8-bit
      // - 14.4: Preserves dynamic range through float pipeline
      // - 14.5: Minimizes color space conversions
      const processedImageData = await this.renderer.renderToImageData(
        imageData,
        adjustments,
        {
          enableDithering: true, // Requirement 14.3
          ditherStrength: 0.5, // Balanced dithering
          preserveColorSpace: true, // Requirement 14.5
        }
      );

      return processedImageData;
    } catch (error) {
      // Check for memory-related errors
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.includes('memory') || errorMsg.includes('allocation')) {
        throw new Error('Out of memory. Try reducing the image resolution.');
      } else if (errorMsg.includes('timeout')) {
        throw new Error('Export processing timeout. Try reducing the image resolution.');
      } else {
        throw new Error(`Export processing failed: ${errorMsg || 'Unknown error'}`);
      }
    }
  }

  /**
   * Encode processed image data to desired format
   */
  private async encodeImage(
    imageData: ImageData,
    settings: ExportSettings,
    metadata: ImageMetadata | null
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get 2D context for encoding');
    }

    ctx.putImageData(imageData, 0, 0);

    // Encode based on format
    switch (settings.format) {
      case 'jpeg':
        return this.encodeJPEG(canvas, settings, metadata);

      case 'png':
        return this.encodePNG(canvas, metadata);

      case 'tiff':
        return this.encodeTIFF(canvas, metadata);

      default:
        throw new Error(`Unsupported format: ${settings.format}`);
    }
  }

  /**
   * Encode as JPEG with quality setting
   */
  private async encodeJPEG(
    canvas: HTMLCanvasElement,
    settings: ExportSettings,
    _metadata: ImageMetadata | null
  ): Promise<Blob> {
    const quality = settings.quality / 100;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // TODO: Embed EXIF metadata if settings.includeMetadata is true
            // This would require a library like piexifjs
            resolve(blob);
          } else {
            reject(new Error('Failed to encode JPEG'));
          }
        },
        'image/jpeg',
        quality
      );
    });
  }

  /**
   * Encode as PNG (lossless)
   */
  private async encodePNG(
    canvas: HTMLCanvasElement,
    _metadata: ImageMetadata | null
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode PNG'));
          }
        },
        'image/png'
      );
    });
  }

  /**
   * Encode as TIFF
   * Note: Browser native support for TIFF encoding is limited
   * This is a placeholder that falls back to PNG
   */
  private async encodeTIFF(
    canvas: HTMLCanvasElement,
    _metadata: ImageMetadata | null
  ): Promise<Blob> {
    // TIFF encoding would require a library like tiff.js
    // For now, fall back to PNG as a lossless alternative
    console.warn('TIFF encoding not fully implemented, using PNG instead');
    return this.encodePNG(canvas, _metadata);
  }

  /**
   * Report progress to callback
   */
  private reportProgress(stage: ExportProgress['stage'], progress: number): void {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress });
    }
  }

  /**
   * Clean up renderer resources
   */
  private cleanup(): void {
    // Renderer cleans up automatically after renderToImageData completes
    this.renderer = null;
  }

  /**
   * Terminate any ongoing export
   */
  public cancel(): void {
    this.aborted = true;
    this.cleanup();
  }
}

/**
 * Trigger browser download of blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL after a delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Generate filename based on format and timestamp
 */
export function generateFilename(
  format: ExportSettings['format'],
  originalName?: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const baseName = originalName
    ? originalName.replace(/\.[^/.]+$/, '')
    : 'pixaro-export';

  return `${baseName}-${timestamp}.${format}`;
}
