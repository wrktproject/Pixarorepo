/**
 * UI Slice
 * Manages UI state including active section, zoom, pan, and tool state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UIState, EditingSection } from '../types/store';

const initialState: UIState = {
  activeSection: 'basic',
  zoom: 1,
  pan: { x: 0, y: 0 },
  showHistogram: true,
  showComparison: false,
  isExportDialogOpen: false,
  activeTool: 'none',
  brushSize: 50,
  loadingState: {
    isLoading: false,
    operation: null,
    progress: undefined,
    estimatedTime: undefined,
  },
  enableToneMapping: false,
  qualityMode: 'preview',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveSection: (state, action: PayloadAction<EditingSection>) => {
      state.activeSection = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.max(0.1, Math.min(10, action.payload));
    },
    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.pan = action.payload;
    },
    resetView: (state) => {
      state.zoom = 1;
      state.pan = { x: 0, y: 0 };
    },
    setShowHistogram: (state, action: PayloadAction<boolean>) => {
      state.showHistogram = action.payload;
    },
    toggleHistogram: (state) => {
      state.showHistogram = !state.showHistogram;
    },
    setShowComparison: (state, action: PayloadAction<boolean>) => {
      state.showComparison = action.payload;
    },
    toggleComparison: (state) => {
      state.showComparison = !state.showComparison;
    },
    setExportDialogOpen: (state, action: PayloadAction<boolean>) => {
      state.isExportDialogOpen = action.payload;
    },
    setActiveTool: (
      state,
      action: PayloadAction<'none' | 'crop' | 'removal'>
    ) => {
      state.activeTool = action.payload;
    },
    setBrushSize: (state, action: PayloadAction<number>) => {
      state.brushSize = Math.max(5, Math.min(200, action.payload));
    },
    setLoadingState: (
      state,
      action: PayloadAction<{
        isLoading: boolean;
        operation?: 'upload' | 'export' | 'ai-processing' | null;
        progress?: number;
        estimatedTime?: number;
      }>
    ) => {
      state.loadingState = {
        isLoading: action.payload.isLoading,
        operation: action.payload.operation ?? null,
        progress: action.payload.progress,
        estimatedTime: action.payload.estimatedTime,
      };
    },
    clearLoadingState: (state) => {
      state.loadingState = {
        isLoading: false,
        operation: null,
        progress: undefined,
        estimatedTime: undefined,
      };
    },
    setEnableToneMapping: (state, action: PayloadAction<boolean>) => {
      state.enableToneMapping = action.payload;
    },
    toggleToneMapping: (state) => {
      state.enableToneMapping = !state.enableToneMapping;
    },
    setQualityMode: (state, action: PayloadAction<'preview' | 'export'>) => {
      state.qualityMode = action.payload;
    },
  },
});

export const {
  setActiveSection,
  setZoom,
  setPan,
  resetView,
  setShowHistogram,
  toggleHistogram,
  setShowComparison,
  toggleComparison,
  setExportDialogOpen,
  setActiveTool,
  setBrushSize,
  setLoadingState,
  clearLoadingState,
  setEnableToneMapping,
  toggleToneMapping,
  setQualityMode,
} = uiSlice.actions;

export default uiSlice.reducer;
