/**
 * Image Types
 * Type definitions for image data and metadata
 */

export interface ProcessedImage {
  data: ImageData;
  width: number;
  height: number;
  colorSpace: string;
}

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  exif: Record<string, any>;
  colorProfile: string;
}

export interface ImageState {
  original: ProcessedImage | null;
  preview: ProcessedImage | null;
  current: ProcessedImage | null;
  metadata: ImageMetadata | null;
  isLoading: boolean;
}
