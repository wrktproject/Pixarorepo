/**
 * Type Definitions Index
 * Central export point for all TypeScript type definitions and interfaces
 */

// Adjustment types
export type {
  ColorChannel,
  HSLAdjustment,
  CropBounds,
  VignetteSettings,
  GrainSettings,
  RemovalMask,
  RemovalOperation,
  AdjustmentState,
} from './adjustments';

// Image types
export type {
  ProcessedImage,
  ImageMetadata,
  ImageState,
} from './image';

// Component types
export type {
  EditingSection,
  ExportFormat,
  CanvasProps,
  CanvasMethods,
  EditingPanelProps,
  SliderControlProps,
  HistogramProps,
  Preset,
  PresetManagerProps,
  RemovalToolProps,
  ExportSettings,
  ExportDialogProps,
  AdContainerProps,
  FileUploaderProps,
} from './components';

// Worker types
export type {
  WorkerTaskType,
  WorkerTask,
  DecodeRawTask,
  AIInpaintTask,
  ExportTask,
  HistogramTask,
  WorkerResponse,
  WorkerPool,
  WorkerPoolConfig,
} from './worker';

// Error types
export {
  ErrorCode,
  PixaroError,
} from './errors';

export type {
  ErrorSeverity,
  AppError,
  ErrorHandlerOptions,
} from './errors';

// State types
export type {
  UIState,
  HistoryState,
  PresetState,
  LoadingState,
} from './state';

// RootState is exported from store/index.ts to avoid circular references
