/**
 * Image Decoder
 * Handles decoding of JPEG, PNG, and TIFF formats with EXIF metadata extraction
 */

import EXIF from 'exif-js';
import { ErrorCode, PixaroError } from '../types/errors';
import type { ProcessedImage, ImageMetadata } from '../types/image';

/**
 * Decode an image file and extract metadata
 */
export async function decodeImage(file: File): Promise<{
  image: ProcessedImage;
  metadata: ImageMetadata;
}> {
  try {
    // Create an image element to load the file
    const img = await loadImageElement(file);

    // Extract EXIF data
    const exifData = await extractExifData(img);

    // Create canvas to extract ImageData
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true,
    });

    if (!ctx) {
      throw new PixaroError({
        code: ErrorCode.BROWSER_NOT_SUPPORTED,
        message: 'Failed to get 2D context from canvas',
        severity: 'fatal',
        recoverable: false,
        userMessage: 'Your browser does not support the required canvas features.',
      });
    }

    // Draw image to canvas
    ctx.drawImage(img, 0, 0);

    // Extract ImageData
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Determine color space (default to sRGB)
    const colorSpace = 'srgb';

    // Get color profile from EXIF if available
    const colorProfile = exifData.ColorSpace
      ? exifData.ColorSpace === 1
        ? 'sRGB'
        : 'AdobeRGB'
      : 'sRGB';

    const processedImage: ProcessedImage = {
      data: imageData,
      width: img.naturalWidth,
      height: img.naturalHeight,
      colorSpace,
    };

    const metadata: ImageMetadata = {
      format: file.type || getFormatFromExtension(file.name),
      width: img.naturalWidth,
      height: img.naturalHeight,
      exif: exifData,
      colorProfile,
    };

    // Clean up
    URL.revokeObjectURL(img.src);

    return { image: processedImage, metadata };
  } catch (error) {
    if (error instanceof PixaroError) {
      throw error;
    }

    throw new PixaroError({
      code: ErrorCode.FILE_CORRUPTED,
      message: `Failed to decode image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      recoverable: true,
      userMessage: 'The image file appears to be corrupted or in an unsupported format.',
      details: { originalError: error },
    });
  }
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new PixaroError({
          code: ErrorCode.FILE_READ_ERROR,
          message: 'Failed to load image',
          severity: 'error',
          recoverable: true,
          userMessage: 'Failed to load the image file. The file may be corrupted.',
        })
      );
    };

    img.src = objectUrl;
  });
}

/**
 * Extract EXIF metadata from an image
 */
function extractExifData(img: HTMLImageElement): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EXIF.getData(img as any, function (this: any) {
      const allTags = EXIF.getAllTags(this);
      resolve(allTags || {});
    });
  });
}

/**
 * Get format from file extension
 */
function getFormatFromExtension(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'tiff':
    case 'tif':
      return 'image/tiff';
    default:
      return 'image/unknown';
  }
}

/**
 * Check if a file is a standard format (JPEG, PNG, TIFF)
 */
export function isStandardFormat(file: File): boolean {
  const standardTypes = ['image/jpeg', 'image/png', 'image/tiff'];
  const extension = file.name.toLowerCase().split('.').pop();
  const standardExtensions = ['jpg', 'jpeg', 'png', 'tiff', 'tif'];

  return (
    standardTypes.includes(file.type) ||
    (extension !== undefined && standardExtensions.includes(extension))
  );
}

/**
 * Check if a file is a RAW format
 */
export function isRawFormat(file: File): boolean {
  const rawTypes = [
    'image/x-canon-cr2',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'image/x-adobe-dng',
  ];
  const extension = file.name.toLowerCase().split('.').pop();
  const rawExtensions = ['cr2', 'nef', 'arw', 'dng'];

  return (
    rawTypes.includes(file.type) ||
    (extension !== undefined && rawExtensions.includes(extension))
  );
}
