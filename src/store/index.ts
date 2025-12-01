/**
 * Redux Store Configuration
 * Configures the Redux store with all slices and middleware
 */

import { configureStore } from '@reduxjs/toolkit';
import imageReducer from './imageSlice';
import adjustmentsReducer from './adjustmentsSlice';
import uiReducer from './uiSlice';
import historyReducer from './historySlice';
import presetReducer from './presetSlice';
import libraryReducer from './librarySlice';
import { historyMiddleware } from './historyMiddleware';

export function makeStore() {
  return configureStore({
    reducer: {
      image: imageReducer,
      adjustments: adjustmentsReducer,
      ui: uiReducer,
      history: historyReducer,
      presets: presetReducer,
      library: libraryReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these paths in the state for serialization checks
          // ImageData and Uint8Array are not serializable but necessary
          ignoredActions: [
            'image/setOriginalImage',
            'image/setCurrentImage',
            'image/setPreviewImage',
            'image/setMetadata',
            'adjustments/addRemovalOperation',
            'adjustments/setAllAdjustments',
            'library/addPhoto',
            'library/updatePhotoAdjustments',
            'history/setPresent',
            'history/resetHistory',
            'ui/setRenderedImageData',
          ],
          ignoredPaths: [
            'image.original.data',
            'image.current.data',
            'image.preview.data',
            'adjustments.removals',
            'history.past',
            'history.present.removals',
            'history.future',
            'library.photos',
            'ui.renderedImageData',
          ],
        },
      }).concat(historyMiddleware),
  });
}

export const store = makeStore();

// Infer types from the store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export all actions for convenience
export {
  setLoading as setImageLoading,
  setOriginalImage,
  setCurrentImage,
  setCurrentImageWithHistory,
  undoImageEdit,
  selectImageHistoryCount,
  setMetadata,
  clearImage,
} from './imageSlice';

export {
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
  setSharpenRadius,
  setSharpenThreshold,
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
  setCropPreview,
  setStraighten,
  setStraightenPreview,
  setFlipHorizontal,
  setFlipVertical,
  setRotation,
  rotateLeft,
  rotateRight,
  setVignetteAmount,
  setVignetteMidpoint,
  setVignetteFeather,
  setGrainAmount,
  setGrainSize,
  setGrainRoughness,
  setLensBlurEnabled,
  setLensBlurAmount,
  setLensBlurMaxBlur,
  setLensBlurFocusDepth,
  setLensBlurFocusRange,
  setLensBlurEdgeProtect,
  setLensBlurShowDepth,
  setLensBlurShowFocus,
  addRemovalOperation,
  removeRemovalOperation,
  clearRemovalOperations,
  setAllAdjustments,
  resetAdjustments,
} from './adjustmentsSlice';

export {
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
  setRenderedImageData,
} from './uiSlice';

export {
  addToHistory,
  undo,
  redo,
  setPresent,
  clearHistory,
  resetHistory,
} from './historySlice';

export {
  setLoading as setPresetLoading,
  setBuiltInPresets,
  saveCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
  loadCustomPresets,
  clearCustomPresets,
} from './presetSlice';

export {
  addPhoto,
  setCurrentPhoto,
  updatePhotoAdjustments,
  removePhoto,
  clearLibrary,
} from './librarySlice';
