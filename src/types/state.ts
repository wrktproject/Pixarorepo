/**
 * Redux State Types
 * Type definitions for Redux store state management
 */

import type { AdjustmentState } from './adjustments';
import type { Preset, EditingSection } from './components';
import type { LibraryState } from '../store/librarySlice';

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
  loadingState: LoadingState;
}

export interface HistoryState {
  past: AdjustmentState[];
  present: AdjustmentState;
  future: AdjustmentState[];
  maxHistorySize: number;
}

export interface PresetState {
  builtIn: Preset[];
  custom: Preset[];
  isLoading: boolean;
}

// Re-export LibraryState for convenience
export type { LibraryState };

// Note: RootState is inferred from the store in src/store/index.ts
// Do not define it here to avoid circular references
