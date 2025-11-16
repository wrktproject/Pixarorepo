/**
 * Built-in Presets
 * Pre-configured adjustment presets for common editing styles
 */

import type { Preset } from '../types/store';
import { createInitialAdjustmentState } from '../store/initialState';

// Use the centralized initial state creator to ensure all new modules are included
const createDefaultAdjustments = createInitialAdjustmentState;

// Built-in preset definitions
export const builtInPresets: Preset[] = [
  {
    id: 'preset_portrait',
    name: 'Portrait',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.3,
      contrast: 10,
      highlights: -15,
      shadows: 20,
      temperature: 6800,
      vibrance: 15,
      saturation: -5,
      clarity: 5,        // Reduced from 15
      sharpening: 10,    // Reduced from 40
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 0, saturation: 10, luminance: 5 },
        red: { hue: 0, saturation: -10, luminance: 0 },
      },
    },
  },
  {
    id: 'preset_landscape',
    name: 'Landscape',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.2,
      contrast: 20,
      highlights: -20,
      shadows: 15,
      vibrance: 30,
      saturation: 10,
      clarity: 10,       // Reduced from 25
      sharpening: 15,    // Reduced from 50
      hsl: {
        ...createDefaultAdjustments().hsl,
        blue: { hue: 0, saturation: 20, luminance: -5 },
        green: { hue: 0, saturation: 15, luminance: 0 },
      },
    },
  },
  {
    id: 'preset_black_white',
    name: 'Black & White',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      contrast: 25,
      highlights: -10,
      shadows: 10,
      saturation: -100,
      clarity: 8,        // Reduced from 20
      sharpening: 12,    // Reduced from 45
    },
  },
  {
    id: 'preset_vintage',
    name: 'Vintage',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.2,
      contrast: -10,
      highlights: -30,
      shadows: 20,
      temperature: 7500,
      tint: 10,
      saturation: -20,
      vignette: {
        amount: -40,
        midpoint: 40,
        feather: 60,
      },
      grain: {
        amount: 8,       // Reduced from 25
        size: 'fine',
      },
    },
  },
  {
    id: 'preset_vibrant',
    name: 'Vibrant',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.3,
      contrast: 25,
      highlights: -15,
      shadows: 20,
      vibrance: 50,
      saturation: 20,
      clarity: 8,        // Reduced from 20
      sharpening: 12,    // Reduced from 40
    },
  },
  {
    id: 'preset_matte',
    name: 'Matte',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.4,
      contrast: -15,
      highlights: -25,
      shadows: 30,
      blacks: 20,
      saturation: -10,
      vignette: {
        amount: -20,
        midpoint: 50,
        feather: 70,
      },
    },
  },
  {
    id: 'preset_dramatic',
    name: 'Dramatic',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: -0.2,
      contrast: 40,
      highlights: -40,
      shadows: -20,
      blacks: -30,
      clarity: 15,       // Reduced from 40
      saturation: 15,
      sharpening: 18,    // Reduced from 60
      vignette: {
        amount: -50,
        midpoint: 30,
        feather: 50,
      },
    },
  },
  {
    id: 'preset_soft',
    name: 'Soft',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.5,
      contrast: -20,
      highlights: -20,
      shadows: 30,
      temperature: 7000,
      saturation: -15,
      clarity: -10,      // Reduced from -30 (less blur)
    },
  },
  {
    id: 'preset_cool',
    name: 'Cool',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      temperature: 5000,
      tint: -10,
      contrast: 15,
      vibrance: 20,
      hsl: {
        ...createDefaultAdjustments().hsl,
        blue: { hue: 0, saturation: 25, luminance: 0 },
        aqua: { hue: 0, saturation: 20, luminance: 0 },
      },
    },
  },
  {
    id: 'preset_warm',
    name: 'Warm',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      temperature: 8000,
      tint: 5,
      contrast: 15,
      vibrance: 20,
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 0, saturation: 20, luminance: 5 },
        yellow: { hue: 0, saturation: 15, luminance: 0 },
      },
    },
  },
  {
    id: 'preset_golden_hour',
    name: 'Golden Hour',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.3,
      contrast: 10,
      highlights: -20,
      shadows: 25,
      temperature: 7800,
      tint: 8,
      vibrance: 25,
      saturation: 10,
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 5, saturation: 30, luminance: 10 },
        yellow: { hue: 0, saturation: 25, luminance: 5 },
      },
    },
  },
  {
    id: 'preset_high_contrast_bw',
    name: 'High Contrast B&W',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      contrast: 50,
      highlights: -30,
      shadows: -20,
      whites: 20,
      blacks: -40,
      saturation: -100,
      clarity: 12,       // Reduced from 30
      sharpening: 18,    // Reduced from 60
    },
  },
  {
    id: 'preset_faded',
    name: 'Faded',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.3,
      contrast: -25,
      highlights: -30,
      shadows: 40,
      blacks: 30,
      saturation: -25,
      vignette: {
        amount: -30,
        midpoint: 45,
        feather: 65,
      },
    },
  },
  {
    id: 'preset_cinematic',
    name: 'Cinematic',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: -0.1,
      contrast: 20,
      highlights: -25,
      shadows: 15,
      blacks: -20,
      temperature: 6200,
      tint: -5,
      saturation: -10,
      vignette: {
        amount: -45,
        midpoint: 35,
        feather: 55,
      },
    },
  },
  {
    id: 'preset_bright_airy',
    name: 'Bright & Airy',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.6,
      contrast: -10,
      highlights: -30,
      shadows: 40,
      whites: 15,
      temperature: 6800,
      saturation: -10,
      clarity: -15,
    },
  },
  {
    id: 'preset_moody',
    name: 'Moody',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: -0.3,
      contrast: 30,
      highlights: -35,
      shadows: -15,
      blacks: -25,
      temperature: 5500,
      saturation: -15,
      clarity: 10,       // Reduced from 25
      vignette: {
        amount: -60,
        midpoint: 30,
        feather: 50,
      },
    },
  },
  {
    id: 'preset_sunset',
    name: 'Sunset',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.2,
      contrast: 20,
      highlights: -25,
      shadows: 20,
      temperature: 8500,
      tint: 15,
      vibrance: 35,
      saturation: 15,
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 10, saturation: 40, luminance: 10 },
        red: { hue: 5, saturation: 30, luminance: 5 },
        purple: { hue: 0, saturation: 25, luminance: -10 },
      },
    },
  },
  {
    id: 'preset_natural',
    name: 'Natural',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.1,
      contrast: 10,
      highlights: -10,
      shadows: 10,
      clarity: 5,        // Reduced from 10
      sharpening: 10,    // Reduced from 30
    },
  },
  {
    id: 'preset_food',
    name: 'Food',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.3,
      contrast: 20,
      highlights: -15,
      shadows: 15,
      temperature: 7200,
      vibrance: 30,
      saturation: 15,
      clarity: 8,        // Reduced from 20
      sharpening: 15,    // Reduced from 50
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 0, saturation: 25, luminance: 5 },
        red: { hue: 0, saturation: 20, luminance: 0 },
        yellow: { hue: 0, saturation: 20, luminance: 5 },
      },
    },
  },
  {
    id: 'preset_urban',
    name: 'Urban',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: -0.1,
      contrast: 30,
      highlights: -20,
      shadows: 10,
      clarity: 12,       // Reduced from 30
      saturation: -10,
      sharpening: 18,    // Reduced from 55
    },
  },
  {
    id: 'preset_pastel',
    name: 'Pastel',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.5,
      contrast: -15,
      highlights: -25,
      shadows: 35,
      temperature: 6800,
      saturation: -20,
      clarity: -8,       // Reduced from -20 (less blur)
      hsl: {
        ...createDefaultAdjustments().hsl,
        red: { hue: 0, saturation: -15, luminance: 10 },
        orange: { hue: 0, saturation: -10, luminance: 10 },
        yellow: { hue: 0, saturation: -10, luminance: 10 },
        green: { hue: 0, saturation: -15, luminance: 10 },
        blue: { hue: 0, saturation: -15, luminance: 10 },
        purple: { hue: 0, saturation: -10, luminance: 10 },
      },
    },
  },
  {
    id: 'preset_autumn',
    name: 'Autumn',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.2,
      contrast: 15,
      highlights: -15,
      shadows: 20,
      temperature: 7500,
      tint: 5,
      vibrance: 25,
      saturation: 10,
      hsl: {
        ...createDefaultAdjustments().hsl,
        orange: { hue: 5, saturation: 35, luminance: 5 },
        yellow: { hue: 10, saturation: 30, luminance: 0 },
        red: { hue: 5, saturation: 25, luminance: 0 },
        green: { hue: 15, saturation: -20, luminance: -10 },
      },
    },
  },
  {
    id: 'preset_summer',
    name: 'Summer',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: 0.4,
      contrast: 10,
      highlights: -20,
      shadows: 25,
      temperature: 7000,
      vibrance: 35,
      saturation: 15,
      hsl: {
        ...createDefaultAdjustments().hsl,
        blue: { hue: 0, saturation: 30, luminance: 5 },
        aqua: { hue: 0, saturation: 25, luminance: 5 },
        yellow: { hue: 0, saturation: 20, luminance: 10 },
      },
    },
  },
  {
    id: 'preset_night',
    name: 'Night',
    isBuiltIn: true,
    adjustments: {
      ...createDefaultAdjustments(),
      exposure: -0.5,
      contrast: 35,
      highlights: -30,
      shadows: -25,
      blacks: -35,
      temperature: 5000,
      tint: -10,
      saturation: -20,
      clarity: 8,        // Reduced from 20
      noiseReductionLuma: 30,
      hsl: {
        ...createDefaultAdjustments().hsl,
        blue: { hue: 0, saturation: 20, luminance: -15 },
        purple: { hue: 0, saturation: 15, luminance: -10 },
      },
    },
  },
];
