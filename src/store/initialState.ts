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

  // Detail adjustments
  sharpening: 0,
  clarity: 0,
  noiseReductionLuma: 0,
  noiseReductionColor: 0,

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

  // Effects
  vignette: {
    amount: 0,
    midpoint: 50,
    feather: 50,
  },
  grain: {
    amount: 0,
    size: 'medium',
  },

  // Removal operations
  removals: [],
});
