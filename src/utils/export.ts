/**
 * Export Utility
 * Handles exporting the final rendered image to various formats
 * Similar to Lightroom's "Export" functionality
 */

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
    try {
      // Check if canvas is using WebGL
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      let exportCanvas: HTMLCanvasElement;
      
      if (gl) {
        // WebGL canvas - need to read pixels and create 2D canvas
        const width = canvas.width;
        const height = canvas.height;
        
        // Create temporary 2D canvas for export
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to create 2D context for export'));
          return;
        }
        
        // Read pixels from WebGL context
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
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
      } else {
        // Regular 2D canvas - use directly
        exportCanvas = canvas;
      }
      
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
    try {
      // Check if canvas is using WebGL
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      let exportCanvas: HTMLCanvasElement;
      
      if (gl) {
        // WebGL canvas - need to read pixels and create 2D canvas
        const width = canvas.width;
        const height = canvas.height;
        
        // Create temporary 2D canvas for export
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to create 2D context for export'));
          return;
        }
        
        // Read pixels from WebGL context
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
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
      } else {
        // Regular 2D canvas - use directly
        exportCanvas = canvas;
      }
      
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

  // Check if canvas is using WebGL
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  let exportCanvas: HTMLCanvasElement;
  
  if (gl) {
    // WebGL canvas - need to read pixels and create 2D canvas
    const width = canvas.width;
    const height = canvas.height;
    
    // Create temporary 2D canvas for export
    exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to create 2D context for export');
    }
    
    // Read pixels from WebGL context
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    
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
  } else {
    // Regular 2D canvas - use directly
    exportCanvas = canvas;
  }

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

