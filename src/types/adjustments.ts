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

  // Detail adjustments
  sharpening: number;     // 0 to 150
  clarity: number;        // -100 to +100
  noiseReductionLuma: number;    // 0 to 100
  noiseReductionColor: number;   // 0 to 100

  // HSL adjustments
  hsl: {
    [key in ColorChannel]: HSLAdjustment;
  };

  // Geometric
  crop: CropBounds | null;
  straighten: number;     // -45 to +45 degrees

  // Effects
  vignette: VignetteSettings;
  grain: GrainSettings;

  // Removal operations (stored as history)
  removals: RemovalOperation[];
}
