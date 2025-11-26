/**
 * Adjustment Types
 * Core type definitions for image adjustment parameters
 */

export type ColorChannel =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';

export interface HSLAdjustment {
  hue: number;        // -100 to +100
  saturation: number; // -100 to +100
  luminance: number;  // -100 to +100
}

export interface CropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number | null;
}

export interface VignetteSettings {
  amount: number;    // -100 to +100
  midpoint: number;  // 0 to 100
  feather: number;   // 0 to 100
}

export interface GrainSettings {
  amount: number;    // 0 to 100
  size: 'fine' | 'medium' | 'coarse';
  roughness: number; // 0 to 100 (clumping/irregularity)
}

export interface RemovalMask {
  pixels: Uint8Array;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface RemovalOperation {
  id: string;
  mask: RemovalMask;
  timestamp: number;
}

export interface SigmoidSettings {
  enabled: boolean;
  contrast: number;         // 0.5 to 2.0
  skew: number;             // -1.0 to 1.0
  middleGrey: number;       // 0.1 to 0.3
  mode: 'per-channel' | 'rgb-ratio';  // Processing mode
  huePreservation: number;  // 0.0 to 1.0
}

export interface FilmicSettings {
  enabled: boolean;
  whitePoint: number;      // 0.5 to 8.0 EV
  blackPoint: number;      // -8.0 to -0.5 EV
  latitude: number;        // 0.1 to 1.0 (10-100%)
  balance: number;         // -0.5 to 0.5 (-50 to 50)
  shadowsContrast: 'hard' | 'soft' | 'safe';
  highlightsContrast: 'hard' | 'soft' | 'safe';
}

export interface ExposureSettings {
  enabled: boolean;
  exposure: number;                    // -10 to 10 EV
  blackPoint: number;                  // 0.0 to 0.1
  highlightReconstruction: boolean;    // Enable highlight recovery
  reconstructionThreshold: number;     // 0.9 to 1.0
}

export interface WhiteBalanceSettings {
  enabled: boolean;
  temperature: number;  // 2000 to 25000 Kelvin
  tint: number;         // -1.0 to 1.0
}

export interface ColorBalanceZoneAdjustment {
  luminance: number;  // -1.0 to 1.0
  chroma: number;     // -1.0 to 1.0
  hue: number;        // -PI to PI (radians)
}

export interface ColorBalanceRGBSettings {
  enabled: boolean;
  
  // Per-zone adjustments
  shadows: ColorBalanceZoneAdjustment;
  midtones: ColorBalanceZoneAdjustment;
  highlights: ColorBalanceZoneAdjustment;
  global: ColorBalanceZoneAdjustment;
  
  // Mask controls
  shadowsWeight: number;      // 0.5 to 3.0 (falloff)
  highlightsWeight: number;   // 0.5 to 3.0 (falloff)
  maskGreyFulcrum: number;    // 0.1 to 0.3 (default 0.1845)
  
  // Advanced controls
  contrast: number;           // 0.5 to 2.0
  contrastFulcrum: number;    // 0.1 to 0.3
  vibrance: number;           // -1.0 to 1.0
}

export interface SaturationSettings {
  enabled: boolean;
  saturation: number;              // -1.0 to 1.0 (global saturation)
  vibrance: number;                // -1.0 to 1.0 (adaptive saturation)
  skinToneProtection: boolean;     // Enable skin tone protection
  skinProtectionStrength: number;  // 0.0 to 1.0 (protection strength)
}

export interface GamutMappingSettings {
  enabled: boolean;
  targetGamut: 'sRGB' | 'Display P3' | 'Rec2020';
  mappingMethod: 'perceptual' | 'saturation' | 'relative';
  compressionAmount: number;       // 0.0 to 1.0 (for perceptual method)
}

export interface GuidedFilterSettings {
  enabled: boolean;
  radius: number;      // Filter radius in pixels (1-20)
  epsilon: number;     // Edge threshold (0.001 - 1.0)
  strength: number;    // Detail enhancement strength (-2.0 to 2.0)
}

export interface LocalLaplacianSettings {
  enabled: boolean;
  detail: number;      // Fine detail enhancement (-1.0 to 1.0)
  coarse: number;      // Coarse structure enhancement (-1.0 to 1.0)
  strength: number;    // Overall strength multiplier (0.0 to 2.0)
  levels: number;      // Number of pyramid levels (3 or 4)
}

export interface ChromaticAberrationSettings {
  enabled: boolean;
  strength: number;    // Correction strength (-1.0 to 1.0)
}

export interface AdjustmentState {
  // Basic adjustments
  exposure: number;        // -5 to +5
  contrast: number;        // -100 to +100
  highlights: number;      // -100 to +100
  shadows: number;         // -100 to +100
  whites: number;          // -100 to +100
  blacks: number;          // -100 to +100

  // Color adjustments
  temperature: number;     // 2000 to 50000 (Kelvin)
  tint: number;           // -150 to +150
  vibrance: number;       // -100 to +100
  saturation: number;     // -100 to +100

  // Detail adjustments (Darktable-style)
  sharpening: number;        // 0 to 150 (amount * 75)
  sharpenRadius: number;     // 0.5 to 10.0 (default 2.0)
  sharpenThreshold: number;  // 0 to 100 (maps to 0-0.1)
  clarity: number;           // -100 to +100
  noiseReductionLuma: number;    // 0 to 100
  noiseReductionColor: number;   // 0 to 100

  // Tone mapping
  sigmoid: SigmoidSettings;
  filmic: FilmicSettings;
  exposureModule: ExposureSettings;
  whiteBalanceModule: WhiteBalanceSettings;
  colorBalanceRGB: ColorBalanceRGBSettings;
  saturationModule: SaturationSettings;
  gamutMapping: GamutMappingSettings;
  guidedFilter: GuidedFilterSettings;
  localLaplacian: LocalLaplacianSettings;

  // HSL adjustments
  hsl: {
    [key in ColorChannel]: HSLAdjustment;
  };

  // Geometric
  crop: CropBounds | null;
  straighten: number;     // -45 to +45 degrees
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: number;       // 0, 90, 180, 270 degrees

  // Effects
  vignette: VignetteSettings;
  grain: GrainSettings;
  chromaticAberration: ChromaticAberrationSettings;

  // Removal operations (stored as history)
  removals: RemovalOperation[];
}
