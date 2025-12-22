/**
 * Export Utility
 * Handles exporting the final rendered image to various formats
 * Similar to Lightroom's "Export" functionality
 */

import { ExportRenderer } from '../engine/exportRenderer';
import type { AdjustmentState } from '../types/adjustments';

/**
 * Flip Y-axis (WebGL bottom-left origin → Canvas top-left origin)
 */
function flipY(data: Uint8Array, width: number, height: number): void {
  const row = width * 4;
  const temp = new Uint8Array(row);
  for (let y = 0; y < height / 2; y++) {
    const top = y * row;
    const bottom = (height - y - 1) * row;
    temp.set(data.slice(top, top + row));
    data.copyWithin(top, bottom, bottom + row);
    data.set(temp, bottom);
  }
}

/**
 * Helper function to read pixels from WebGL canvas and create a 2D canvas
 */
function readWebGLCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  if (!gl) {
    // Not a WebGL canvas, return original
    return canvas;
  }
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Validate dimensions
  if (width === 0 || height === 0) {
    throw new Error('Canvas has zero dimensions');
  }
  
  // Check if context is lost
  if (gl.isContextLost()) {
    throw new Error('WebGL context is lost');
  }
  
  // Create temporary 2D canvas for export
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to create 2D context for export');
  }
  
  try {
    // Ensure we're reading from the default framebuffer (0)
    // Save current framebuffer binding
    const currentFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    
    // Bind to default framebuffer (the canvas)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    // Force GPU to complete all pending operations
    gl.flush();
    gl.finish();
    
    // Read pixels from WebGL context
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
    // Restore previous framebuffer binding
    if (currentFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
    }
    
    console.log('📸 Read WebGL pixels, first 20 values:', Array.from(pixels.slice(0, 20)));
    
    // Flip vertically (WebGL has origin at bottom-left, canvas has top-left)
    const flippedPixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4;
      const dstRow = y * width * 4;
      flippedPixels.set(pixels.subarray(srcRow, srcRow + width * 4), dstRow);
    }
    
    // Put image data on 2D canvas
    const imageData = new ImageData(flippedPixels, width, height);
    ctx.putImageData(imageData, 0, 0);
    
    return exportCanvas;
  } catch (error) {
    throw new Error(`Failed to read WebGL pixels: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export directly from FBO pixels (correct approach for offscreen rendering)
 * This reads pixels from the final framebuffer, not the canvas
 */
export async function exportFromFBO(
  pixels: Uint8Array,
  width: number,
  height: number,
  options: ExportOptions
): Promise<void> {
  const {
    format = 'jpeg',
    quality = 0.95,
    filename = `pixaro-export-${Date.now()}`,
  } = options;

  console.log('📸 Exporting from FBO pixels...', {
    dimensions: `${width}x${height}`,
    format,
    quality,
    firstPixels: Array.from(pixels.slice(0, 20))
  });

  try {
    // Flip Y-axis (WebGL uses bottom-left origin, canvas uses top-left)
    flipY(pixels, width, height);

    // Create a 2D canvas for encoding
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D context for export');
    }

    // Create ImageData and put it on canvas
    const imageData = new ImageData(
      new Uint8ClampedArray(pixels),
      width,
      height
    );
    ctx.putImageData(imageData, 0, 0);

    // Determine MIME type
    const mimeType = `image/${format}`;

    // Convert canvas to blob and download
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }

          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.${format}`;

          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);

          console.log(`✅ Exported image: ${link.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        },
        mimeType,
        format === 'png' ? undefined : quality
      );
    });
  } catch (error) {
    console.error('Export from FBO failed:', error);
    throw error;
  }
}

/**
 * Export directly from a canvas element (WebGL or 2D)
 * This is the preferred method as it exports what's already rendered on screen
 */
export async function exportFromCanvas(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<void> {
  const {
    format = 'jpeg',
    quality = 0.95,
    filename = `pixaro-export-${Date.now()}`,
  } = options;

  console.log('📸 Exporting from canvas...', {
    canvasDimensions: `${canvas.width}x${canvas.height}`,
    format,
    quality
  });

  try {
    // CRITICAL: For WebGL canvases, we need to render the final output to the canvas backing store
    // Check if this is a WebGL canvas
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      console.log('📸 Detected WebGL canvas, rendering output to backing store...');
      // Trigger a render to canvas - this will be handled by the Canvas component
      // We need to dispatch an event or call a method to do this
      // For now, let's just wait a frame
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    
    // Get export canvas (handles WebGL if needed)
    const exportCanvas = readWebGLCanvas(canvas);
    
    console.log('✅ Canvas read, dimensions:', exportCanvas.width, 'x', exportCanvas.height);
    
    // Determine MIME type
    const mimeType = `image/${format}`;
    
    // Convert canvas to blob and download
    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }

          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.${format}`;
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          console.log(`✅ Exported image: ${link.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        },
        mimeType,
        format === 'png' ? undefined : quality
      );
    });
  } catch (error) {
    console.error('Export from canvas failed:', error);
    throw error;
  }
}

export interface ExportOptions {
  /** Output format */
  format: 'jpeg' | 'png' | 'webp';
  
  /** Quality (0-1) for JPEG/WebP */
  quality?: number;
  
  /** Filename (without extension) */
  filename?: string;
  
  /** Resize options */
  resize?: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill';
  };
  
  /** Metadata options */
  metadata?: {
    includeExif?: boolean;
    copyright?: string;
    author?: string;
  };
}

/**
 * Export image with adjustments applied using the full-resolution ExportRenderer
 * This is the preferred method as it doesn't depend on the display canvas buffer
 */
export async function exportImageWithAdjustments(
  imageData: ImageData,
  adjustments: AdjustmentState,
  options: ExportOptions
): Promise<void> {
  const {
    format = 'jpeg',
    quality = 0.95,
    filename = `pixaro-export-${Date.now()}`,
  } = options;

  try {
    console.log('📸 Starting export...', {
      dimensions: `${imageData.width}x${imageData.height}`,
      format,
      quality,
      adjustments: {
        exposure: adjustments.exposure,
        contrast: adjustments.contrast,
        temperature: adjustments.temperature,
        crop: adjustments.crop,
        rotation: adjustments.rotation
      }
    });

    let renderedImageData: ImageData;

    // ALWAYS use ExportRenderer to ensure all adjustments are applied
    // The renderer is smart enough to skip unnecessary operations
    console.log('📸 Using ExportRenderer to apply all adjustments...');
    try {
      const exportRenderer = new ExportRenderer();
      renderedImageData = await exportRenderer.renderToImageData(imageData, adjustments, {
        enableDithering: true,
        ditherStrength: 0.5,
        preserveColorSpace: true,
      });
      console.log('✅ ExportRenderer completed');
    } catch (renderError) {
      console.error('ExportRenderer failed, using original image:', renderError);
      // Fall back to direct export without adjustments
      renderedImageData = imageData;
    }

    console.log('✅ Rendered image data:', {
      width: renderedImageData.width,
      height: renderedImageData.height,
      dataLength: renderedImageData.data.length,
      firstPixels: Array.from(renderedImageData.data.slice(0, 12))
    });

    // Create a canvas to convert ImageData to blob
    const canvas = document.createElement('canvas');
    canvas.width = renderedImageData.width;
    canvas.height = renderedImageData.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to create 2D context for export');
    }

    ctx.putImageData(renderedImageData, 0, 0);

    // Convert to blob and download
    const mimeType = `image/${format}`;
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }

          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.${format}`;
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          console.log(`✅ Exported image: ${link.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        },
        mimeType,
        format === 'png' ? undefined : quality
      );
    });
  } catch (error) {
    console.error('Export with adjustments failed:', error);
    throw error;
  }
}

/**
 * Export canvas to file and trigger download
 * Handles both WebGL and 2D canvas contexts
 */
export async function exportCanvasToFile(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<void> {
  const {
    format = 'jpeg',
    quality = 0.95,
    filename = `pixaro-export-${Date.now()}`,
  } = options;

  return new Promise((resolve, reject) => {
    // Wait for next frame to ensure render is complete
    requestAnimationFrame(() => {
      try {
        // Get export canvas (handles WebGL if needed)
        const exportCanvas = readWebGLCanvas(canvas);
      
      // Determine MIME type
      const mimeType = `image/${format}`;
      
      // Convert canvas to blob
      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }

          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.${format}`;
          
          // Trigger download
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up
          setTimeout(() => URL.revokeObjectURL(url), 100);
          
          console.log(`✅ Exported image: ${link.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        },
        mimeType,
        format === 'png' ? undefined : quality
      );
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Export canvas to blob for further processing
 * Handles both WebGL and 2D canvas contexts
 */
export async function exportCanvasToBlob(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<Blob> {
  const {
    format = 'jpeg',
    quality = 0.95,
  } = options;

  return new Promise((resolve, reject) => {
    // Wait for next frame to ensure render is complete
    requestAnimationFrame(() => {
      try {
        // Get export canvas (handles WebGL if needed)
        const exportCanvas = readWebGLCanvas(canvas);
        
        const mimeType = `image/${format}`;
        
        exportCanvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create image blob'));
              return;
            }
            resolve(blob);
          },
          mimeType,
          format === 'png' ? undefined : quality
        );
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Export canvas to data URL
 * Handles both WebGL and 2D canvas contexts
 */
export function exportCanvasToDataURL(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): string {
  const {
    format = 'jpeg',
    quality = 0.95,
  } = options;

  // Note: This is synchronous, so we can't wait for render
  // Caller should ensure render is complete before calling
  const exportCanvas = readWebGLCanvas(canvas);
  
  const mimeType = `image/${format}`;
  return exportCanvas.toDataURL(mimeType, format === 'png' ? undefined : quality);
}

/**
 * Copy canvas to clipboard
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  try {
    const blob = await exportCanvasToBlob(canvas, { format: 'png' });
    
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    
    console.log('✅ Image copied to clipboard');
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy image to clipboard. Your browser may not support this feature.');
  }
}

/**
 * Get recommended export settings based on image dimensions
 */
export function getRecommendedExportSettings(
  width: number,
  height: number
): {
  web: ExportOptions;
  print: ExportOptions;
  social: ExportOptions;
} {
  return {
    web: {
      format: 'jpeg',
      quality: 0.85,
      resize: {
        width: Math.min(width, 2048),
        height: Math.min(height, 2048),
        fit: 'contain',
      },
    },
    print: {
      format: 'jpeg',
      quality: 0.95,
      // No resize for print - use full resolution
    },
    social: {
      format: 'jpeg',
      quality: 0.80,
      resize: {
        width: Math.min(width, 1080),
        height: Math.min(height, 1080),
        fit: 'cover',
      },
    },
  };
}

/**
 * Estimate exported file size (approximate)
 */
export function estimateExportSize(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = 0.9
): number {
  const pixels = width * height;
  
  if (format === 'png') {
    // PNG is lossless, larger files
    return pixels * 3; // ~3 bytes per pixel
  } else if (format === 'jpeg') {
    // JPEG is lossy, smaller files
    const baseSize = pixels * 0.5; // ~0.5 bytes per pixel
    return baseSize * quality;
  } else if (format === 'webp') {
    // WebP is efficient
    const baseSize = pixels * 0.3; // ~0.3 bytes per pixel
    return baseSize * quality;
  }
  
  return pixels * 2; // Default estimate
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}

