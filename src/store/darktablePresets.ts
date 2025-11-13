/**
 * Darktable-Inspired Default Presets
 * Professional-grade presets using the new Darktable modules
 */

import type { Preset } from '../types/store';
import { createInitialAdjustmentState } from './initialState';

export function createDarktablePresets(): Preset[] {
  const baseState = createInitialAdjustmentState();

  return [
    // ========================================
    // FILM EMULATION PRESETS
    // ========================================
    
    {
      id: 'dt_filmic_standard',
      name: 'Filmic Standard',
      adjustments: {
        ...baseState,
        filmic: {
          enabled: true,
          whitePoint: 4.0,
          blackPoint: -8.0,
          latitude: 0.5,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_filmic_high_contrast',
      name: 'Filmic High Contrast',
      adjustments: {
        ...baseState,
        filmic: {
          enabled: true,
          whitePoint: 3.5,
          blackPoint: -7.0,
          latitude: 0.3,
          balance: 0.0,
          shadowsContrast: 'hard',
          highlightsContrast: 'hard',
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_filmic_low_contrast',
      name: 'Filmic Low Contrast',
      adjustments: {
        ...baseState,
        filmic: {
          enabled: true,
          whitePoint: 5.0,
          blackPoint: -9.0,
          latitude: 0.7,
          balance: 0.0,
          shadowsContrast: 'safe',
          highlightsContrast: 'safe',
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'film_kodak_portra',
      name: 'Film: Kodak Portra',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.2,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.5,
          blackPoint: -8.5,
          latitude: 0.6,
          balance: 0.1,
          shadowsContrast: 'soft',
          highlightsContrast: 'safe',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: 0.0,
            chroma: 0.1,
            hue: 0.4, // Warm shadows
          },
          midtones: {
            luminance: 0.05,
            chroma: 0.05,
            hue: 0.2,
          },
          highlights: {
            luminance: 0.0,
            chroma: 0.08,
            hue: 0.15,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.1,
          highlightsWeight: 1.0,
          maskGreyFulcrum: 0.1845,
          contrast: 0.95,
          contrastFulcrum: 0.1845,
          vibrance: 0.15,
        },
        saturationModule: {
          enabled: true,
          saturation: -0.05,
          vibrance: 0.2,
          skinToneProtection: true,
          skinProtectionStrength: 0.9,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'film_fuji_velvia',
      name: 'Film: Fuji Velvia',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.1,
        },
        filmic: {
          enabled: true,
          whitePoint: 3.8,
          blackPoint: -7.5,
          latitude: 0.4,
          balance: -0.1,
          shadowsContrast: 'hard',
          highlightsContrast: 'soft',
        },
        saturationModule: {
          enabled: true,
          saturation: 0.4,
          vibrance: 0.3,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.3,
          coarse: 0.2,
          strength: 1.2,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'film_kodak_tri_x',
      name: 'Film: Kodak Tri-X',
      adjustments: {
        ...baseState,
        saturationModule: {
          enabled: true,
          saturation: -1.0,
          vibrance: 0.0,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.2,
          blackPoint: -7.8,
          latitude: 0.55,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
        guidedFilter: {
          enabled: true,
          radius: 3,
          epsilon: 0.02,
          strength: 0.2, // Slight grain texture
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'film_cinematic',
      name: 'Film: Cinematic',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.15,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.0,
          blackPoint: -7.0,
          latitude: 0.45,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: -0.05,
            chroma: 0.15,
            hue: 3.8, // Teal shadows
          },
          midtones: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          highlights: {
            luminance: 0.05,
            chroma: 0.12,
            hue: 0.5, // Warm highlights
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.2,
          highlightsWeight: 1.1,
          maskGreyFulcrum: 0.1845,
          contrast: 1.05,
          contrastFulcrum: 0.1845,
          vibrance: 0.1,
        },
        saturationModule: {
          enabled: true,
          saturation: -0.1,
          vibrance: 0.15,
          skinToneProtection: true,
          skinProtectionStrength: 0.7,
        },
      },
      isBuiltIn: true,
    },

    // ========================================
    // PORTRAIT PRESETS
    // ========================================
    
    {
      id: 'dt_portrait_natural',
      name: 'Portrait: Natural',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.3,
        },
        saturationModule: {
          enabled: true,
          saturation: -0.1,
          vibrance: 0.2,
          skinToneProtection: true,
          skinProtectionStrength: 0.8,
        },
        guidedFilter: {
          enabled: true,
          radius: 8,
          epsilon: 0.05,
          strength: -0.3, // Slight smoothing
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_portrait_dramatic',
      name: 'Portrait: Dramatic',
      adjustments: {
        ...baseState,
        filmic: {
          enabled: true,
          whitePoint: 3.5,
          blackPoint: -7.5,
          latitude: 0.4,
          balance: 0.1,
          shadowsContrast: 'hard',
          highlightsContrast: 'soft',
        },
        localLaplacian: {
          enabled: true,
          detail: 0.3,
          coarse: 0.2,
          strength: 1.2,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'portrait_soft_glow',
      name: 'Portrait: Soft Glow',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.4,
        },
        sigmoid: {
          enabled: true,
          contrast: 0.7,
          skew: 0.2,
          middleGrey: 0.1845,
        },
        saturationModule: {
          enabled: true,
          saturation: -0.15,
          vibrance: 0.15,
          skinToneProtection: true,
          skinProtectionStrength: 0.9,
        },
        guidedFilter: {
          enabled: true,
          radius: 12,
          epsilon: 0.08,
          strength: -0.5, // Strong smoothing for glow effect
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: 0.05,
            chroma: 0.05,
            hue: 0.3,
          },
          midtones: {
            luminance: 0.1,
            chroma: 0.0,
            hue: 0.0,
          },
          highlights: {
            luminance: 0.15,
            chroma: 0.08,
            hue: 0.1,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.0,
          highlightsWeight: 0.9,
          maskGreyFulcrum: 0.1845,
          contrast: 0.9,
          contrastFulcrum: 0.1845,
          vibrance: 0.1,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'portrait_high_key',
      name: 'Portrait: High Key',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.8,
        },
        filmic: {
          enabled: true,
          whitePoint: 5.5,
          blackPoint: -7.0,
          latitude: 0.7,
          balance: 0.3,
          shadowsContrast: 'safe',
          highlightsContrast: 'safe',
        },
        saturationModule: {
          enabled: true,
          saturation: -0.2,
          vibrance: 0.1,
          skinToneProtection: true,
          skinProtectionStrength: 0.85,
        },
        guidedFilter: {
          enabled: true,
          radius: 10,
          epsilon: 0.06,
          strength: -0.4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'portrait_low_key',
      name: 'Portrait: Low Key',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: -0.3,
        },
        filmic: {
          enabled: true,
          whitePoint: 3.0,
          blackPoint: -6.5,
          latitude: 0.35,
          balance: -0.2,
          shadowsContrast: 'hard',
          highlightsContrast: 'soft',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: -0.1,
            chroma: 0.1,
            hue: 0.0,
          },
          midtones: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          highlights: {
            luminance: 0.1,
            chroma: 0.15,
            hue: 0.2,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.4,
          highlightsWeight: 1.2,
          maskGreyFulcrum: 0.1845,
          contrast: 1.2,
          contrastFulcrum: 0.1845,
          vibrance: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.4,
          coarse: 0.3,
          strength: 1.3,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'portrait_beauty',
      name: 'Portrait: Beauty',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.35,
        },
        sigmoid: {
          enabled: true,
          contrast: 0.75,
          skew: 0.15,
          middleGrey: 0.1845,
        },
        saturationModule: {
          enabled: true,
          saturation: -0.05,
          vibrance: 0.25,
          skinToneProtection: true,
          skinProtectionStrength: 0.95,
        },
        guidedFilter: {
          enabled: true,
          radius: 15,
          epsilon: 0.1,
          strength: -0.6, // Strong skin smoothing
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          midtones: {
            luminance: 0.05,
            chroma: 0.05,
            hue: 0.15,
          },
          highlights: {
            luminance: 0.1,
            chroma: 0.1,
            hue: 0.1,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.0,
          highlightsWeight: 0.9,
          maskGreyFulcrum: 0.1845,
          contrast: 0.95,
          contrastFulcrum: 0.1845,
          vibrance: 0.15,
        },
      },
      isBuiltIn: true,
    },

    // ========================================
    // LANDSCAPE PRESETS
    // ========================================
    
    {
      id: 'dt_landscape_vivid',
      name: 'Landscape: Vivid',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.2,
        },
        saturationModule: {
          enabled: true,
          saturation: 0.3,
          vibrance: 0.4,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.4,
          coarse: 0.3,
          strength: 1.3,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_landscape_soft',
      name: 'Landscape: Soft',
      adjustments: {
        ...baseState,
        sigmoid: {
          enabled: true,
          contrast: 0.8,
          skew: 0.1,
          middleGrey: 0.1845,
        },
        saturationModule: {
          enabled: true,
          saturation: 0.1,
          vibrance: 0.2,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'landscape_dramatic',
      name: 'Landscape: Dramatic',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.1,
        },
        filmic: {
          enabled: true,
          whitePoint: 3.5,
          blackPoint: -7.5,
          latitude: 0.4,
          balance: 0.0,
          shadowsContrast: 'hard',
          highlightsContrast: 'hard',
        },
        saturationModule: {
          enabled: true,
          saturation: 0.25,
          vibrance: 0.35,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.5,
          coarse: 0.4,
          strength: 1.4,
          levels: 4,
        },
        guidedFilter: {
          enabled: true,
          radius: 5,
          epsilon: 0.02,
          strength: 0.3,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'landscape_golden_hour',
      name: 'Landscape: Golden Hour',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.25,
        },
        whiteBalanceModule: {
          enabled: true,
          temperature: 4800,
          tint: 0.15,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.5,
          blackPoint: -8.0,
          latitude: 0.55,
          balance: 0.1,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: 0.0,
            chroma: 0.15,
            hue: 0.6, // Warm orange shadows
          },
          midtones: {
            luminance: 0.05,
            chroma: 0.1,
            hue: 0.4,
          },
          highlights: {
            luminance: 0.1,
            chroma: 0.2,
            hue: 0.3, // Golden highlights
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.1,
          highlightsWeight: 1.2,
          maskGreyFulcrum: 0.1845,
          contrast: 1.05,
          contrastFulcrum: 0.1845,
          vibrance: 0.2,
        },
        saturationModule: {
          enabled: true,
          saturation: 0.15,
          vibrance: 0.25,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'landscape_blue_hour',
      name: 'Landscape: Blue Hour',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.3,
        },
        whiteBalanceModule: {
          enabled: true,
          temperature: 8000,
          tint: -0.1,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.2,
          blackPoint: -7.8,
          latitude: 0.5,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: -0.05,
            chroma: 0.2,
            hue: 4.2, // Deep blue shadows
          },
          midtones: {
            luminance: 0.0,
            chroma: 0.15,
            hue: 4.0,
          },
          highlights: {
            luminance: 0.05,
            chroma: 0.1,
            hue: 0.5, // Warm highlights for contrast
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.3,
          highlightsWeight: 1.0,
          maskGreyFulcrum: 0.1845,
          contrast: 1.1,
          contrastFulcrum: 0.1845,
          vibrance: 0.15,
        },
        saturationModule: {
          enabled: true,
          saturation: 0.2,
          vibrance: 0.3,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'landscape_moody',
      name: 'Landscape: Moody',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: -0.1,
        },
        filmic: {
          enabled: true,
          whitePoint: 3.8,
          blackPoint: -7.0,
          latitude: 0.45,
          balance: -0.15,
          shadowsContrast: 'hard',
          highlightsContrast: 'soft',
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: -0.1,
            chroma: 0.15,
            hue: 3.9, // Teal/cyan shadows
          },
          midtones: {
            luminance: -0.05,
            chroma: 0.05,
            hue: 0.0,
          },
          highlights: {
            luminance: 0.0,
            chroma: 0.1,
            hue: 0.4,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.4,
          highlightsWeight: 1.0,
          maskGreyFulcrum: 0.1845,
          contrast: 1.15,
          contrastFulcrum: 0.1845,
          vibrance: 0.1,
        },
        saturationModule: {
          enabled: true,
          saturation: 0.1,
          vibrance: 0.2,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.35,
          coarse: 0.25,
          strength: 1.25,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'landscape_hdr',
      name: 'Landscape: HDR',
      adjustments: {
        ...baseState,
        exposureModule: {
          ...baseState.exposureModule,
          exposure: 0.15,
          highlightReconstruction: true,
          reconstructionThreshold: 0.9,
        },
        filmic: {
          enabled: true,
          whitePoint: 5.0,
          blackPoint: -9.0,
          latitude: 0.65,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'safe',
        },
        saturationModule: {
          enabled: true,
          saturation: 0.35,
          vibrance: 0.4,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        localLaplacian: {
          enabled: true,
          detail: 0.6,
          coarse: 0.5,
          strength: 1.5,
          levels: 4,
        },
        guidedFilter: {
          enabled: true,
          radius: 4,
          epsilon: 0.015,
          strength: 0.4,
        },
      },
      isBuiltIn: true,
    },

    // Black & White Presets
    {
      id: 'dt_bw_classic',
      name: 'Classic B&W',
      adjustments: {
        ...baseState,
        saturationModule: {
          enabled: true,
          saturation: -1.0, // Full desaturation
          vibrance: 0.0,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        filmic: {
          enabled: true,
          whitePoint: 4.0,
          blackPoint: -8.0,
          latitude: 0.5,
          balance: 0.0,
          shadowsContrast: 'soft',
          highlightsContrast: 'soft',
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_bw_high_contrast',
      name: 'High Contrast B&W',
      adjustments: {
        ...baseState,
        saturationModule: {
          enabled: true,
          saturation: -1.0,
          vibrance: 0.0,
          skinToneProtection: false,
          skinProtectionStrength: 0.0,
        },
        filmic: {
          enabled: true,
          whitePoint: 3.0,
          blackPoint: -7.0,
          latitude: 0.3,
          balance: -0.2,
          shadowsContrast: 'hard',
          highlightsContrast: 'hard',
        },
        localLaplacian: {
          enabled: true,
          detail: 0.5,
          coarse: 0.3,
          strength: 1.4,
          levels: 4,
        },
      },
      isBuiltIn: true,
    },

    // Color Grading Presets
    {
      id: 'dt_warm_sunset',
      name: 'Warm Sunset',
      adjustments: {
        ...baseState,
        whiteBalanceModule: {
          enabled: true,
          temperature: 5000,
          tint: 0.1,
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: 0.0,
            chroma: 0.2,
            hue: 0.5, // Warm orange
          },
          midtones: {
            luminance: 0.1,
            chroma: 0.1,
            hue: 0.3,
          },
          highlights: {
            luminance: 0.0,
            chroma: 0.15,
            hue: 0.2,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.2,
          highlightsWeight: 1.0,
          maskGreyFulcrum: 0.1845,
          contrast: 1.1,
          contrastFulcrum: 0.1845,
          vibrance: 0.2,
        },
      },
      isBuiltIn: true,
    },
    {
      id: 'dt_cool_blue',
      name: 'Cool Blue',
      adjustments: {
        ...baseState,
        whiteBalanceModule: {
          enabled: true,
          temperature: 7500,
          tint: -0.1,
        },
        colorBalanceRGB: {
          enabled: true,
          shadows: {
            luminance: -0.1,
            chroma: 0.15,
            hue: 4.0, // Cool blue
          },
          midtones: {
            luminance: 0.0,
            chroma: 0.1,
            hue: 4.2,
          },
          highlights: {
            luminance: 0.05,
            chroma: 0.1,
            hue: 4.5,
          },
          global: {
            luminance: 0.0,
            chroma: 0.0,
            hue: 0.0,
          },
          shadowsWeight: 1.3,
          highlightsWeight: 1.0,
          maskGreyFulcrum: 0.1845,
          contrast: 1.05,
          contrastFulcrum: 0.1845,
          vibrance: 0.15,
        },
      },
      isBuiltIn: true,
    },
  ];
}
