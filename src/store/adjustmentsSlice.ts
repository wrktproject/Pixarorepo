/**
 * Adjustments Slice
 * Manages all image adjustment parameters with value clamping
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AdjustmentState,
  ColorChannel,
  CropBounds,
  RemovalOperation,
} from '../types/adjustments';
import { createInitialAdjustmentState } from './initialState';

const initialState: AdjustmentState = createInitialAdjustmentState();

// Helper function to clamp values within range
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const adjustmentsSlice = createSlice({
  name: 'adjustments',
  initialState,
  reducers: {
    // Basic adjustments
    setExposure: (state, action: PayloadAction<number>) => {
      state.exposure = clamp(action.payload, -5, 5);
    },
    setContrast: (state, action: PayloadAction<number>) => {
      state.contrast = clamp(action.payload, -100, 100);
    },
    setHighlights: (state, action: PayloadAction<number>) => {
      state.highlights = clamp(action.payload, -100, 100);
    },
    setShadows: (state, action: PayloadAction<number>) => {
      state.shadows = clamp(action.payload, -100, 100);
    },
    setWhites: (state, action: PayloadAction<number>) => {
      state.whites = clamp(action.payload, -100, 100);
    },
    setBlacks: (state, action: PayloadAction<number>) => {
      state.blacks = clamp(action.payload, -100, 100);
    },

    // Color adjustments
    setTemperature: (state, action: PayloadAction<number>) => {
      state.temperature = clamp(action.payload, 2000, 50000);
    },
    setTint: (state, action: PayloadAction<number>) => {
      state.tint = clamp(action.payload, -150, 150);
    },
    setVibrance: (state, action: PayloadAction<number>) => {
      state.vibrance = clamp(action.payload, -100, 100);
    },
    setSaturation: (state, action: PayloadAction<number>) => {
      state.saturation = clamp(action.payload, -100, 100);
    },

    // Detail adjustments
    setSharpening: (state, action: PayloadAction<number>) => {
      state.sharpening = clamp(action.payload, 0, 150);
    },
    setClarity: (state, action: PayloadAction<number>) => {
      state.clarity = clamp(action.payload, -100, 100);
    },
    setNoiseReductionLuma: (state, action: PayloadAction<number>) => {
      state.noiseReductionLuma = clamp(action.payload, 0, 100);
    },
    setNoiseReductionColor: (state, action: PayloadAction<number>) => {
      state.noiseReductionColor = clamp(action.payload, 0, 100);
    },

    // HSL adjustments
    setHSLHue: (
      state,
      action: PayloadAction<{ channel: ColorChannel; value: number }>
    ) => {
      state.hsl[action.payload.channel].hue = clamp(
        action.payload.value,
        -100,
        100
      );
    },
    setHSLSaturation: (
      state,
      action: PayloadAction<{ channel: ColorChannel; value: number }>
    ) => {
      state.hsl[action.payload.channel].saturation = clamp(
        action.payload.value,
        -100,
        100
      );
    },
    setHSLLuminance: (
      state,
      action: PayloadAction<{ channel: ColorChannel; value: number }>
    ) => {
      state.hsl[action.payload.channel].luminance = clamp(
        action.payload.value,
        -100,
        100
      );
    },

    // Geometric adjustments
    setCrop: (state, action: PayloadAction<CropBounds | null>) => {
      state.crop = action.payload;
    },
    setStraighten: (state, action: PayloadAction<number>) => {
      state.straighten = clamp(action.payload, -45, 45);
    },

    // Effects
    setVignetteAmount: (state, action: PayloadAction<number>) => {
      state.vignette.amount = clamp(action.payload, -100, 100);
    },
    setVignetteMidpoint: (state, action: PayloadAction<number>) => {
      state.vignette.midpoint = clamp(action.payload, 0, 100);
    },
    setVignetteFeather: (state, action: PayloadAction<number>) => {
      state.vignette.feather = clamp(action.payload, 0, 100);
    },
    setGrainAmount: (state, action: PayloadAction<number>) => {
      state.grain.amount = clamp(action.payload, 0, 100);
    },
    setGrainSize: (
      state,
      action: PayloadAction<'fine' | 'medium' | 'coarse'>
    ) => {
      state.grain.size = action.payload;
    },

    // Removal operations
    addRemovalOperation: (state, action: PayloadAction<RemovalOperation>) => {
      state.removals.push(action.payload);
    },
    removeRemovalOperation: (state, action: PayloadAction<string>) => {
      state.removals = state.removals.filter((op) => op.id !== action.payload);
    },
    clearRemovalOperations: (state) => {
      state.removals = [];
    },

    // Bulk operations
    setAllAdjustments: (_state, action: PayloadAction<AdjustmentState>) => {
      return action.payload;
    },
    resetAdjustments: () => {
      return createInitialAdjustmentState();
    },
  },
});

export const {
  setExposure,
  setContrast,
  setHighlights,
  setShadows,
  setWhites,
  setBlacks,
  setTemperature,
  setTint,
  setVibrance,
  setSaturation,
  setSharpening,
  setClarity,
  setNoiseReductionLuma,
  setNoiseReductionColor,
  setHSLHue,
  setHSLSaturation,
  setHSLLuminance,
  setCrop,
  setStraighten,
  setVignetteAmount,
  setVignetteMidpoint,
  setVignetteFeather,
  setGrainAmount,
  setGrainSize,
  addRemovalOperation,
  removeRemovalOperation,
  clearRemovalOperations,
  setAllAdjustments,
  resetAdjustments,
} = adjustmentsSlice.actions;

export default adjustmentsSlice.reducer;
