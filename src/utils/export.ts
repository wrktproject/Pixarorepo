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
      // Determine MIME type
      const mimeType = `image/${format}`;
      
      // Convert canvas to blob
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
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Export canvas to blob for further processing
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
    const mimeType = `image/${format}`;
    
    canvas.toBlob(
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
  });
}

/**
 * Export canvas to data URL
 */
export function exportCanvasToDataURL(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): string {
  const {
    format = 'jpeg',
    quality = 0.95,
  } = options;

  const mimeType = `image/${format}`;
  return canvas.toDataURL(mimeType, format === 'png' ? undefined : quality);
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

