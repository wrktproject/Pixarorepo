/**
 * Image Loader
 * Unified interface for loading both standard and RAW image formats
 */

import { decodeImage, isStandardFormat, isRawFormat } from './imageDecoder';
import { createRawDecoderPool } from './workerPool';
import { ErrorCode, PixaroError } from '../types/errors';
import type { ProcessedImage, ImageMetadata } from '../types/image';
import type { DecodeRawTask } from '../types/worker';

// Singleton worker pool for RAW decoding
let rawDecoderPool: ReturnType<typeof createRawDecoderPool> | null = null;

/**
 * Load an image file (standard or RAW format)
 */
export async function loadImage(file: File): Promise<{
  image: ProcessedImage;
  metadata: ImageMetadata;
}> {
  // Handle standard formats (JPEG, PNG, TIFF)
  if (isStandardFormat(file)) {
    return await decodeImage(file);
  }

  // Handle RAW formats (CR2, NEF, ARW, DNG)
  if (isRawFormat(file)) {
    return await loadRawImage(file);
  }

  // Unsupported format
  throw new PixaroError({
    code: ErrorCode.UNSUPPORTED_FORMAT,
    message: `Unsupported file format: ${file.type}`,
    severity: 'error',
    recoverable: true,
    userMessage: 'This file format is not supported. Please upload a JPEG, PNG, TIFF, or RAW file.',
    details: { fileType: file.type, fileName: file.name },
  });
}

/**
 * Load a RAW image file using Web Worker
 */
async function loadRawImage(file: File): Promise<{
  image: ProcessedImage;
  metadata: ImageMetadata;
}> {
  try {
    // Initialize worker pool if not already created
    if (!rawDecoderPool) {
      rawDecoderPool = createRawDecoderPool();
    }

    // Read file as ArrayBuffer
    const fileBuffer = await readFileAsArrayBuffer(file);

    // Create decode task
    const task: DecodeRawTask = {
      type: 'decode-raw',
      payload: {
        fileBuffer,
        fileName: file.name,
      },
    };

    // Execute task in worker (with 30 second timeout)
    const result = await rawDecoderPool.execute<{
      imageData: ImageData;
      width: number;
      height: number;
      metadata: Record<string, any>;
    }>(task, 30000);

    const processedImage: ProcessedImage = {
      data: result.imageData,
      width: result.width,
      height: result.height,
      colorSpace: 'srgb',
    };

    const metadata: ImageMetadata = {
      format: file.type || `image/x-${file.name.split('.').pop()}`,
      width: result.width,
      height: result.height,
      exif: result.metadata,
      colorProfile: 'sRGB',
    };

    return { image: processedImage, metadata };
  } catch (error) {
    if (error instanceof PixaroError) {
      throw error;
    }

    throw new PixaroError({
      code: ErrorCode.FILE_READ_ERROR,
      message: `Failed to decode RAW file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      recoverable: true,
      userMessage:
        error instanceof Error && error.message.includes('not yet implemented')
          ? error.message
          : 'Failed to decode RAW file. The file may be corrupted or in an unsupported RAW format.',
      details: { originalError: error },
    });
  }
}

/**
 * Read a file as ArrayBuffer
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };

    reader.onerror = () => {
      reject(
        new PixaroError({
          code: ErrorCode.FILE_READ_ERROR,
          message: 'Failed to read file',
          severity: 'error',
          recoverable: true,
          userMessage: 'Failed to read the file. Please try again.',
        })
      );
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Terminate the RAW decoder worker pool
 */
export function terminateRawDecoderPool(): void {
  if (rawDecoderPool) {
    rawDecoderPool.terminate();
    rawDecoderPool = null;
  }
}
