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

    // Sigmoid tone mapping
    setSigmoidEnabled: (state, action: PayloadAction<boolean>) => {
      state.sigmoid.enabled = action.payload;
    },
    setSigmoidContrast: (state, action: PayloadAction<number>) => {
      state.sigmoid.contrast = clamp(action.payload, 0.5, 2.0);
    },
    setSigmoidSkew: (state, action: PayloadAction<number>) => {
      state.sigmoid.skew = clamp(action.payload, -1.0, 1.0);
    },
    setSigmoidMiddleGrey: (state, action: PayloadAction<number>) => {
      state.sigmoid.middleGrey = clamp(action.payload, 0.1, 0.3);
    },

    // Filmic tone mapping
    setFilmicEnabled: (state, action: PayloadAction<boolean>) => {
      state.filmic.enabled = action.payload;
    },
    setFilmicWhitePoint: (state, action: PayloadAction<number>) => {
      state.filmic.whitePoint = clamp(action.payload, 0.5, 8.0);
    },
    setFilmicBlackPoint: (state, action: PayloadAction<number>) => {
      state.filmic.blackPoint = clamp(action.payload, -8.0, -0.5);
    },
    setFilmicLatitude: (state, action: PayloadAction<number>) => {
      state.filmic.latitude = clamp(action.payload, 0.1, 1.0);
    },
    setFilmicBalance: (state, action: PayloadAction<number>) => {
      state.filmic.balance = clamp(action.payload, -0.5, 0.5);
    },
    setFilmicShadowsContrast: (
      state,
      action: PayloadAction<'hard' | 'soft' | 'safe'>
    ) => {
      state.filmic.shadowsContrast = action.payload;
    },
    setFilmicHighlightsContrast: (
      state,
      action: PayloadAction<'hard' | 'soft' | 'safe'>
    ) => {
      state.filmic.highlightsContrast = action.payload;
    },

    // Exposure module
    setExposureModuleEnabled: (state, action: PayloadAction<boolean>) => {
      state.exposureModule.enabled = action.payload;
    },
    setExposureModuleExposure: (state, action: PayloadAction<number>) => {
      state.exposureModule.exposure = clamp(action.payload, -10, 10);
    },
    setExposureModuleBlackPoint: (state, action: PayloadAction<number>) => {
      state.exposureModule.blackPoint = clamp(action.payload, 0.0, 0.1);
    },
    setExposureModuleHighlightReconstruction: (state, action: PayloadAction<boolean>) => {
      state.exposureModule.highlightReconstruction = action.payload;
    },
    setExposureModuleReconstructionThreshold: (state, action: PayloadAction<number>) => {
      state.exposureModule.reconstructionThreshold = clamp(action.payload, 0.9, 1.0);
    },

    // White balance module
    setWhiteBalanceModuleEnabled: (state, action: PayloadAction<boolean>) => {
      state.whiteBalanceModule.enabled = action.payload;
    },
    setWhiteBalanceModuleTemperature: (state, action: PayloadAction<number>) => {
      state.whiteBalanceModule.temperature = clamp(action.payload, 2000, 25000);
    },
    setWhiteBalanceModuleTint: (state, action: PayloadAction<number>) => {
      state.whiteBalanceModule.tint = clamp(action.payload, -1.0, 1.0);
    },

    // Color Balance RGB module
    setColorBalanceRGBEnabled: (state, action: PayloadAction<boolean>) => {
      state.colorBalanceRGB.enabled = action.payload;
    },
    setColorBalanceRGBShadows: (state, action: PayloadAction<{ luminance: number; chroma: number; hue: number }>) => {
      state.colorBalanceRGB.shadows.luminance = clamp(action.payload.luminance, -1.0, 1.0);
      state.colorBalanceRGB.shadows.chroma = clamp(action.payload.chroma, -1.0, 1.0);
      state.colorBalanceRGB.shadows.hue = action.payload.hue; // No clamping for hue (radians)
    },
    setColorBalanceRGBMidtones: (state, action: PayloadAction<{ luminance: number; chroma: number; hue: number }>) => {
      state.colorBalanceRGB.midtones.luminance = clamp(action.payload.luminance, -1.0, 1.0);
      state.colorBalanceRGB.midtones.chroma = clamp(action.payload.chroma, -1.0, 1.0);
      state.colorBalanceRGB.midtones.hue = action.payload.hue; // No clamping for hue (radians)
    },
    setColorBalanceRGBHighlights: (state, action: PayloadAction<{ luminance: number; chroma: number; hue: number }>) => {
      state.colorBalanceRGB.highlights.luminance = clamp(action.payload.luminance, -1.0, 1.0);
      state.colorBalanceRGB.highlights.chroma = clamp(action.payload.chroma, -1.0, 1.0);
      state.colorBalanceRGB.highlights.hue = action.payload.hue; // No clamping for hue (radians)
    },
    setColorBalanceRGBGlobal: (state, action: PayloadAction<{ luminance: number; chroma: number; hue: number }>) => {
      state.colorBalanceRGB.global.luminance = clamp(action.payload.luminance, -1.0, 1.0);
      state.colorBalanceRGB.global.chroma = clamp(action.payload.chroma, -1.0, 1.0);
      state.colorBalanceRGB.global.hue = action.payload.hue; // No clamping for hue (radians)
    },
    setColorBalanceRGBShadowsWeight: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.shadowsWeight = clamp(action.payload, 0.5, 3.0);
    },
    setColorBalanceRGBHighlightsWeight: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.highlightsWeight = clamp(action.payload, 0.5, 3.0);
    },
    setColorBalanceRGBMaskGreyFulcrum: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.maskGreyFulcrum = clamp(action.payload, 0.1, 0.3);
    },
    setColorBalanceRGBContrast: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.contrast = clamp(action.payload, 0.5, 2.0);
    },
    setColorBalanceRGBContrastFulcrum: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.contrastFulcrum = clamp(action.payload, 0.1, 0.3);
    },
    setColorBalanceRGBVibrance: (state, action: PayloadAction<number>) => {
      state.colorBalanceRGB.vibrance = clamp(action.payload, -1.0, 1.0);
    },

    // Saturation module
    setSaturationModuleEnabled: (state, action: PayloadAction<boolean>) => {
      state.saturationModule.enabled = action.payload;
    },
    setSaturationModuleSaturation: (state, action: PayloadAction<number>) => {
      state.saturationModule.saturation = clamp(action.payload, -1.0, 1.0);
    },
    setSaturationModuleVibrance: (state, action: PayloadAction<number>) => {
      state.saturationModule.vibrance = clamp(action.payload, -1.0, 1.0);
    },
    setSaturationModuleSkinToneProtection: (state, action: PayloadAction<boolean>) => {
      state.saturationModule.skinToneProtection = action.payload;
    },
    setSaturationModuleSkinProtectionStrength: (state, action: PayloadAction<number>) => {
      state.saturationModule.skinProtectionStrength = clamp(action.payload, 0.0, 1.0);
    },

    // Gamut mapping module
    setGamutMappingEnabled: (state, action: PayloadAction<boolean>) => {
      state.gamutMapping.enabled = action.payload;
    },
    setGamutMappingTargetGamut: (state, action: PayloadAction<'sRGB' | 'Display P3' | 'Rec2020'>) => {
      state.gamutMapping.targetGamut = action.payload;
    },
    setGamutMappingMethod: (state, action: PayloadAction<'perceptual' | 'saturation' | 'relative'>) => {
      state.gamutMapping.mappingMethod = action.payload;
    },
    setGamutMappingCompressionAmount: (state, action: PayloadAction<number>) => {
      state.gamutMapping.compressionAmount = clamp(action.payload, 0.0, 1.0);
    },

    // Guided filter module
    setGuidedFilterEnabled: (state, action: PayloadAction<boolean>) => {
      state.guidedFilter.enabled = action.payload;
    },
    setGuidedFilterRadius: (state, action: PayloadAction<number>) => {
      state.guidedFilter.radius = clamp(action.payload, 1, 20);
    },
    setGuidedFilterEpsilon: (state, action: PayloadAction<number>) => {
      state.guidedFilter.epsilon = clamp(action.payload, 0.001, 1.0);
    },
    setGuidedFilterStrength: (state, action: PayloadAction<number>) => {
      state.guidedFilter.strength = clamp(action.payload, -2.0, 2.0);
    },

    // Local Laplacian module
    setLocalLaplacianEnabled: (state, action: PayloadAction<boolean>) => {
      state.localLaplacian.enabled = action.payload;
    },
    setLocalLaplacianDetail: (state, action: PayloadAction<number>) => {
      state.localLaplacian.detail = clamp(action.payload, -1.0, 1.0);
    },
    setLocalLaplacianCoarse: (state, action: PayloadAction<number>) => {
      state.localLaplacian.coarse = clamp(action.payload, -1.0, 1.0);
    },
    setLocalLaplacianStrength: (state, action: PayloadAction<number>) => {
      state.localLaplacian.strength = clamp(action.payload, 0.0, 2.0);
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
  setSigmoidEnabled,
  setSigmoidContrast,
  setSigmoidSkew,
  setSigmoidMiddleGrey,
  setFilmicEnabled,
  setFilmicWhitePoint,
  setFilmicBlackPoint,
  setFilmicLatitude,
  setFilmicBalance,
  setFilmicShadowsContrast,
  setFilmicHighlightsContrast,
  setExposureModuleEnabled,
  setExposureModuleExposure,
  setExposureModuleBlackPoint,
  setExposureModuleHighlightReconstruction,
  setExposureModuleReconstructionThreshold,
  setWhiteBalanceModuleEnabled,
  setWhiteBalanceModuleTemperature,
  setWhiteBalanceModuleTint,
  setColorBalanceRGBEnabled,
  setColorBalanceRGBShadows,
  setColorBalanceRGBMidtones,
  setColorBalanceRGBHighlights,
  setColorBalanceRGBGlobal,
  setColorBalanceRGBShadowsWeight,
  setColorBalanceRGBHighlightsWeight,
  setColorBalanceRGBMaskGreyFulcrum,
  setColorBalanceRGBContrast,
  setColorBalanceRGBContrastFulcrum,
  setColorBalanceRGBVibrance,
  setSaturationModuleEnabled,
  setSaturationModuleSaturation,
  setSaturationModuleVibrance,
  setSaturationModuleSkinToneProtection,
  setSaturationModuleSkinProtectionStrength,
  setGamutMappingEnabled,
  setGamutMappingTargetGamut,
  setGamutMappingMethod,
  setGamutMappingCompressionAmount,
  setGuidedFilterEnabled,
  setGuidedFilterRadius,
  setGuidedFilterEpsilon,
  setGuidedFilterStrength,
  setLocalLaplacianEnabled,
  setLocalLaplacianDetail,
  setLocalLaplacianCoarse,
  setLocalLaplacianStrength,
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
