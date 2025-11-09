/**
 * Component Props Interfaces
 * Type definitions for React component props
 */

import type { AdjustmentState, RemovalMask } from './adjustments';
import type { ProcessedImage, ImageMetadata } from './image';

export type EditingSection =
  | 'basic'
  | 'color'
  | 'detail'
  | 'effects'
  | 'hsl'
  | 'crop'
  | 'removal';

export type ExportFormat = 'jpeg' | 'png' | 'tiff';

// Canvas Component Props
export interface CanvasProps {
  imageData: ImageData;
  adjustments: AdjustmentState;
  zoom: number;
  pan: { x: number; y: number };
}

export interface CanvasMethods {
  resetView(): void;
  fitToScreen(): void;
  exportImage(format: ExportFormat, quality: number): Blob;
}

// Editing Panel Props
export interface EditingPanelProps {
  activeSection: EditingSection;
  onSectionChange: (section: EditingSection) => void;
}

// Slider Control Props
export interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
}

// Histogram Props
export interface HistogramProps {
  imageData: ImageData;
  width: number;
  height: number;
}

// Preset Types
export interface Preset {
  id: string;
  name: string;
  adjustments: AdjustmentState;
  thumbnail?: string;
  isBuiltIn: boolean;
}

export interface PresetManagerProps {
  presets: Preset[];
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

// Removal Tool Props
export interface RemovalToolProps {
  imageData: ImageData;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onRemovalComplete: (result: ImageData) => void;
}

// Export Dialog Props
export interface ExportSettings {
  format: ExportFormat;
  quality: number; // 1-100 for JPEG
  width: number;
  height: number;
  maintainAspectRatio: boolean;
  includeMetadata: boolean;
}

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  currentImage: ProcessedImage | null;
}

// Ad Container Props
export interface AdContainerProps {
  adSlot: string;
  position: 'sidebar' | 'bottom';
  maxRefreshInterval: number; // milliseconds
}

// File Uploader Props
export interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  maxFileSize?: number; // in bytes
  acceptedFormats?: string[];
}
