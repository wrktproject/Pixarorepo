/**
 * Edge Case Tests for Shader Pipeline
 * Tests black, white, and saturated color handling
 * Requirements: 15.5
 */

import { describe, it, expect } from 'vitest';
import {
  srgbToLinear,
  linearToSrgb,
  rgbToHsl,
  hslToRgb,
  getLuminance,
  clamp,
} from './colorUtils';

describe('Edge Cases - Pure Colors', () => {
  describe('Pure Black (0, 0, 0)', () => {
    it('should handle black in color space conversions', () => {
      const r = srgbToLinear(0);
      const g = srgbToLinear(0);
      const b = srgbToLinear(0);
      
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
      
      // Round trip
      expect(linearToSrgb(r)).toBe(0);
      expect(linearToSrgb(g)).toBe(0);
      expect(linearToSrgb(b)).toBe(0);
    });

    it('should have zero luminance', () => {
      const lum = getLuminance(0, 0, 0);
      expect(lum).toBe(0);
    });

    it('should convert to HSL correctly', () => {
      const hsl = rgbToHsl(0, 0, 0);
      
      expect(hsl.h).toBe(0); // Hue undefined for black, defaults to 0
      expect(hsl.s).toBe(0); // No saturation
      expect(hsl.l).toBe(0); // Zero lightness
    });

    it('should remain black after exposure adjustment', () => {
      const exposureStops = 5.0; // Even +5 stops
      const adjusted = 0 * Math.pow(2.0, exposureStops);
      
      expect(adjusted).toBe(0);
    });
  });

  describe('Pure White (1, 1, 1)', () => {
    it('should handle white in color space conversions', () => {
      const r = srgbToLinear(1);
      const g = srgbToLinear(1);
      const b = srgbToLinear(1);
      
      expect(r).toBe(1);
      expect(g).toBe(1);
      expect(b).toBe(1);
      
      // Round trip
      expect(linearToSrgb(r)).toBe(1);
      expect(linearToSrgb(g)).toBe(1);
      expect(linearToSrgb(b)).toBe(1);
    });

    it('should have maximum luminance', () => {
      const lum = getLuminance(1, 1, 1);
      expect(lum).toBeCloseTo(1.0, 5);
    });

    it('should convert to HSL correctly', () => {
      const hsl = rgbToHsl(1, 1, 1);
      
      expect(hsl.h).toBe(0); // Hue undefined for white, defaults to 0
      expect(hsl.s).toBe(0); // No saturation
      expect(hsl.l).toBe(1); // Maximum lightness
    });

    it('should clip when exposure increases beyond 1.0', () => {
      const exposureStops = 1.0;
      const adjusted = 1.0 * Math.pow(2.0, exposureStops);
      
      expect(adjusted).toBe(2.0); // Before clamping
      expect(clamp(adjusted, 0, 1)).toBe(1.0); // After clamping
    });
  });

  describe('Pure Red (1, 0, 0)', () => {
    it('should maintain red channel in conversions', () => {
      const linear = srgbToLinear(1);
      expect(linear).toBe(1);
      
      const backToSrgb = linearToSrgb(linear);
      expect(backToSrgb).toBe(1);
    });

    it('should have correct luminance', () => {
      const lum = getLuminance(1, 0, 0);
      expect(lum).toBeCloseTo(0.2126, 4); // Rec. 709 red weight
    });

    it('should convert to HSL with hue 0', () => {
      const hsl = rgbToHsl(1, 0, 0);
      
      expect(hsl.h).toBeCloseTo(0, 2); // Red hue
      expect(hsl.s).toBeCloseTo(1, 2); // Fully saturated
      expect(hsl.l).toBeCloseTo(0.5, 2); // Mid lightness
    });

    it('should round-trip through HSL correctly', () => {
      const hsl = rgbToHsl(1, 0, 0);
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      
      expect(rgb.r).toBeCloseTo(1, 2);
      expect(rgb.g).toBeCloseTo(0, 2);
      expect(rgb.b).toBeCloseTo(0, 2);
    });
  });

  describe('Pure Green (0, 1, 0)', () => {
    it('should have correct luminance', () => {
      const lum = getLuminance(0, 1, 0);
      expect(lum).toBeCloseTo(0.7152, 4); // Rec. 709 green weight
    });

    it('should convert to HSL with hue ~0.333', () => {
      const hsl = rgbToHsl(0, 1, 0);
      
      expect(hsl.h).toBeCloseTo(0.333, 2); // Green hue
      expect(hsl.s).toBeCloseTo(1, 2); // Fully saturated
      expect(hsl.l).toBeCloseTo(0.5, 2); // Mid lightness
    });
  });

  describe('Pure Blue (0, 0, 1)', () => {
    it('should have correct luminance', () => {
      const lum = getLuminance(0, 0, 1);
      expect(lum).toBeCloseTo(0.0722, 4); // Rec. 709 blue weight
    });

    it('should convert to HSL with hue ~0.667', () => {
      const hsl = rgbToHsl(0, 0, 1);
      
      expect(hsl.h).toBeCloseTo(0.667, 2); // Blue hue
      expect(hsl.s).toBeCloseTo(1, 2); // Fully saturated
      expect(hsl.l).toBeCloseTo(0.5, 2); // Mid lightness
    });
  });
});

describe('Edge Cases - Saturated Colors', () => {
  describe('Fully Saturated Colors', () => {
    const saturatedColors = [
      { name: 'Red', r: 1, g: 0, b: 0 },
      { name: 'Yellow', r: 1, g: 1, b: 0 },
      { name: 'Green', r: 0, g: 1, b: 0 },
      { name: 'Cyan', r: 0, g: 1, b: 1 },
      { name: 'Blue', r: 0, g: 0, b: 1 },
      { name: 'Magenta', r: 1, g: 0, b: 1 },
    ];

    saturatedColors.forEach(({ name, r, g, b }) => {
      it(`should handle ${name} correctly in HSL conversion`, () => {
        const hsl = rgbToHsl(r, g, b);
        
        // All should be fully saturated
        expect(hsl.s).toBeCloseTo(1, 2);
        
        // Round trip should preserve color
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        expect(rgb.r).toBeCloseTo(r, 2);
        expect(rgb.g).toBeCloseTo(g, 2);
        expect(rgb.b).toBeCloseTo(b, 2);
      });
    });
  });

  describe('Oversaturated Colors (Out of Gamut)', () => {
    it('should clamp oversaturated values', () => {
      // Simulate a color that exceeds sRGB gamut
      const oversaturated = { r: 1.5, g: 0.5, b: -0.2 };
      
      const clamped = {
        r: clamp(oversaturated.r, 0, 1),
        g: clamp(oversaturated.g, 0, 1),
        b: clamp(oversaturated.b, 0, 1),
      };
      
      expect(clamped.r).toBe(1.0);
      expect(clamped.g).toBe(0.5);
      expect(clamped.b).toBe(0.0);
    });

    it('should handle saturation boost on already saturated colors', () => {
      const hsl = rgbToHsl(1, 0, 0); // Pure red
      expect(hsl.s).toBeCloseTo(1, 2);
      
      // Try to boost saturation further
      const boostedS = clamp(hsl.s * 1.5, 0, 1);
      expect(boostedS).toBe(1.0); // Should stay at 1.0
      
      // Color should remain the same
      const rgb = hslToRgb(hsl.h, boostedS, hsl.l);
      expect(rgb.r).toBeCloseTo(1, 2);
      expect(rgb.g).toBeCloseTo(0, 2);
      expect(rgb.b).toBeCloseTo(0, 2);
    });
  });
});

describe('Edge Cases - Grayscale', () => {
  describe('Neutral Grays', () => {
    const grays = [
      { value: 0.0, name: 'Black' },
      { value: 0.18, name: '18% Gray' },
      { value: 0.5, name: 'Mid Gray' },
      { value: 0.75, name: 'Light Gray' },
      { value: 1.0, name: 'White' },
    ];

    grays.forEach(({ value, name }) => {
      it(`should handle ${name} (${value}) correctly`, () => {
        const hsl = rgbToHsl(value, value, value);
        
        // Should have zero saturation
        expect(hsl.s).toBe(0);
        
        // Lightness should match value
        expect(hsl.l).toBeCloseTo(value, 2);
        
        // Round trip should preserve gray
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        expect(rgb.r).toBeCloseTo(value, 2);
        expect(rgb.g).toBeCloseTo(value, 2);
        expect(rgb.b).toBeCloseTo(value, 2);
      });
    });
  });

  describe('Near-Grayscale Colors', () => {
    it('should handle very low saturation colors', () => {
      // Almost gray, but slightly warm
      const nearGray = { r: 0.51, g: 0.50, b: 0.49 };
      
      const hsl = rgbToHsl(nearGray.r, nearGray.g, nearGray.b);
      
      // Should have very low saturation
      expect(hsl.s).toBeGreaterThan(0);
      expect(hsl.s).toBeLessThan(0.1);
      
      // Round trip should preserve color
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      expect(rgb.r).toBeCloseTo(nearGray.r, 2);
      expect(rgb.g).toBeCloseTo(nearGray.g, 2);
      expect(rgb.b).toBeCloseTo(nearGray.b, 2);
    });
  });
});

describe('Edge Cases - Extreme Adjustments', () => {
  describe('Extreme Exposure', () => {
    it('should handle +10 stops without NaN', () => {
      const value = 0.01;
      const exposureStops = 10.0;
      
      const adjusted = value * Math.pow(2.0, exposureStops);
      
      expect(adjusted).not.toBeNaN();
      expect(adjusted).toBeGreaterThan(0);
      expect(isFinite(adjusted)).toBe(true);
    });

    it('should handle -10 stops without underflow', () => {
      const value = 0.5;
      const exposureStops = -10.0;
      
      const adjusted = value * Math.pow(2.0, exposureStops);
      
      expect(adjusted).not.toBeNaN();
      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(isFinite(adjusted)).toBe(true);
    });
  });

  describe('Extreme Contrast', () => {
    it('should handle zero contrast', () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0];
      const contrast = 0.0;
      
      values.forEach((value) => {
        const adjusted = (value - 0.5) * contrast + 0.5;
        expect(adjusted).toBeCloseTo(0.5, 5); // All values collapse to midpoint
      });
    });

    it('should handle very high contrast', () => {
      const value = 0.6;
      const contrast = 10.0;
      
      const adjusted = (value - 0.5) * contrast + 0.5;
      
      expect(adjusted).not.toBeNaN();
      expect(isFinite(adjusted)).toBe(true);
    });
  });

  describe('Extreme Saturation', () => {
    it('should handle zero saturation (complete desaturation)', () => {
      const color = { r: 1, g: 0, b: 0 }; // Pure red
      const hsl = rgbToHsl(color.r, color.g, color.b);
      
      // Set saturation to 0
      hsl.s = 0;
      
      const gray = hslToRgb(hsl.h, hsl.s, hsl.l);
      
      // Should be gray
      expect(gray.r).toBeCloseTo(gray.g, 2);
      expect(gray.g).toBeCloseTo(gray.b, 2);
    });

    it('should handle maximum saturation boost', () => {
      const color = { r: 0.8, g: 0.5, b: 0.3 };
      const hsl = rgbToHsl(color.r, color.g, color.b);
      
      // Boost to maximum
      hsl.s = 1.0;
      
      const boosted = hslToRgb(hsl.h, hsl.s, hsl.l);
      
      expect(boosted.r).not.toBeNaN();
      expect(boosted.g).not.toBeNaN();
      expect(boosted.b).not.toBeNaN();
    });
  });
});

describe('Edge Cases - Numerical Stability', () => {
  describe('Very Small Values', () => {
    it('should handle near-zero values without underflow', () => {
      const verySmall = 0.0001;
      
      const linear = srgbToLinear(verySmall);
      expect(linear).toBeGreaterThanOrEqual(0);
      expect(isFinite(linear)).toBe(true);
      
      const backToSrgb = linearToSrgb(linear);
      expect(backToSrgb).toBeGreaterThanOrEqual(0);
      expect(isFinite(backToSrgb)).toBe(true);
    });
  });

  describe('Very Large Values (HDR)', () => {
    it('should handle HDR values in tone mapping', () => {
      const hdrValues = [10.0, 100.0, 1000.0];
      
      hdrValues.forEach((hdr) => {
        const toneMapped = hdr / (hdr + 1.0);
        
        expect(toneMapped).toBeGreaterThan(0);
        expect(toneMapped).toBeLessThan(1.0);
        expect(isFinite(toneMapped)).toBe(true);
      });
    });
  });

  describe('Division by Zero Protection', () => {
    it('should handle zero in luminance calculation', () => {
      const lum = getLuminance(0, 0, 0);
      expect(lum).toBe(0);
      expect(isFinite(lum)).toBe(true);
    });

    it('should handle zero in HSL conversion', () => {
      const hsl = rgbToHsl(0, 0, 0);
      
      expect(isFinite(hsl.h)).toBe(true);
      expect(isFinite(hsl.s)).toBe(true);
      expect(isFinite(hsl.l)).toBe(true);
    });
  });
});
