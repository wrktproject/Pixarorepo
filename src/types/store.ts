/**
 * Store Types
 * Type definitions for Redux store state
 */

import type { AdjustmentState } from './adjustments';

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
  exif: Record<string, unknown>;
  colorProfile: string;
}

export interface ImageState {
  original: ProcessedImage | null;
  preview: ProcessedImage | null; // Downscaled version for real-time adjustments
  current: ProcessedImage | null;
  metadata: ImageMetadata | null;
  isLoading: boolean;
}

export type EditingSection =
  | 'basic'
  | 'color'
  | 'detail'
  | 'effects'
  | 'hsl'
  | 'crop'
  | 'removal';

export interface LoadingState {
  isLoading: boolean;
  operation: 'upload' | 'export' | 'ai-processing' | null;
  progress?: number; // 0-100
  estimatedTime?: number; // in seconds
}

export interface UIState {
  activeSection: EditingSection;
  zoom: number;
  pan: { x: number; y: number };
  showHistogram: boolean;
  showComparison: boolean;
  isExportDialogOpen: boolean;
  activeTool: 'none' | 'crop' | 'removal';
  brushSize: number;
  showGrid: boolean;
  loadingState: LoadingState;
  enableToneMapping: boolean;
  qualityMode: 'preview' | 'export';
  renderedImageData: ImageData | null;
}

export interface HistoryState {
  past: AdjustmentState[];
  present: AdjustmentState;
  future: AdjustmentState[];
  maxHistorySize: number;
}

export interface Preset {
  id: string;
  name: string;
  adjustments: AdjustmentState;
  thumbnail?: string;
  isBuiltIn: boolean;
}

export interface PresetState {
  builtIn: Preset[];
  custom: Preset[];
  isLoading: boolean;
}

// Note: RootState is inferred from the store in src/store/index.ts
