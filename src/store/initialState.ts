/**
 * Initial State Definitions
 * Default values for all adjustment parameters
 */

import type { AdjustmentState } from '../types/adjustments';

export const createInitialAdjustmentState = (): AdjustmentState => ({
  // Basic adjustments
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,

  // Color adjustments
  temperature: 6500, // Neutral daylight
  tint: 0,
  vibrance: 0,
  saturation: 0,

  // Detail adjustments (Darktable-style sharpening)
  sharpening: 0,
  sharpenRadius: 2.0,      // Darktable default
  sharpenThreshold: 0.5,   // Darktable default (maps to 0.005)
  clarity: 0,
  noiseReductionLuma: 0,
  noiseReductionColor: 0,

  // Tone mapping
  sigmoid: {
    enabled: false,
    contrast: 1.0,
    skew: 0.0,
    middleGrey: 0.1845, // 18.45% grey (photographic standard)
    mode: 'per-channel',
    huePreservation: 0.0,
  },
  filmic: {
    enabled: false,
    whitePoint: 4.0,
    blackPoint: -8.0,
    latitude: 0.5,  // 50%
    balance: 0.0,
    shadowsContrast: 'soft',
    highlightsContrast: 'soft',
  },
  exposureModule: {
    enabled: false,  // Disabled by default - use basic exposure slider instead
    exposure: 0.0,
    blackPoint: 0.0,
    highlightReconstruction: false,
    reconstructionThreshold: 0.95,
  },
  whiteBalanceModule: {
    enabled: false,  // Disabled by default - use basic temperature/tint sliders instead
    temperature: 6500,  // D65 daylight
    tint: 0.0,
  },
  colorBalanceRGB: {
    enabled: false,
    shadows: {
      luminance: 0.0,
      chroma: 0.0,
      hue: 0.0,
    },
    midtones: {
      luminance: 0.0,
      chroma: 0.0,
      hue: 0.0,
    },
    highlights: {
      luminance: 0.0,
      chroma: 0.0,
      hue: 0.0,
    },
    global: {
      luminance: 0.0,
      chroma: 0.0,
      hue: 0.0,
    },
    shadowsWeight: 1.0,
    highlightsWeight: 1.0,
    maskGreyFulcrum: 0.1845, // 18.45% grey (photographic standard)
    contrast: 1.0,
    contrastFulcrum: 0.1845,
    vibrance: 0.0,
  },
  saturationModule: {
    enabled: false,
    saturation: 0.0,
    vibrance: 0.0,
    skinToneProtection: true,
    skinProtectionStrength: 0.5,
  },
  gamutMapping: {
    enabled: false,
    targetGamut: 'sRGB',
    mappingMethod: 'perceptual',
    compressionAmount: 0.8,
  },
  guidedFilter: {
    enabled: false,
    radius: 5,
    epsilon: 0.01,
    strength: 0.0,
  },
  localLaplacian: {
    enabled: false,
    detail: 0.0,
    coarse: 0.0,
    strength: 1.0,
    levels: 4,
  },

  // HSL adjustments
  hsl: {
    red: { hue: 0, saturation: 0, luminance: 0 },
    orange: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    aqua: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    purple: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 },
  },

  // Geometric
  crop: null,
  straighten: 0,
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,

  // Effects
  vignette: {
    amount: 0,
    midpoint: 50,
    feather: 50,
  },
  grain: {
    amount: 0,
    size: 'medium',
    roughness: 50, // Default moderate roughness
  },
  chromaticAberration: {
    enabled: false,
    strength: 0.0,
  },

  // Removal operations
  removals: [],
});
