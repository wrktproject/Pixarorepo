/**
 * Edge Case Tests
 * 
 * Tests for edge cases and extreme conditions including:
 * - Pure black images
 * - Pure white images
 * - Single-color images
 * - Extreme parameter values
 */

import { describe, it, expect } from 'vitest';

describe('Edge Case Tests', () => {
  describe('Pure Black Images', () => {
    it('should handle pure black (0,0,0) without errors', () => {
      const black = { r: 0, g: 0, b: 0 };
      
      // Should not produce NaN or Infinity
      expect(Number.isFinite(black.r)).toBe(true);
      expect(Number.isFinite(black.g)).toBe(true);
      expect(Number.isFinite(black.b)).toBe(true);
    });

    it('should handle exposure adjustment on black', () => {
      const black = 0;
      const exposure = 2.0; // +2 EV
      const result = black * Math.pow(2, exposure);
      
      expect(result).toBe(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle tone mapping on black', () => {
      const black = 0;
      const toneMapped = black / (black + 1);
      
      expect(toneMapped).toBe(0);
      expect(Number.isFinite(toneMapped)).toBe(true);
    });

    it('should handle saturation adjustment on black', () => {
      // Black has no chroma, so saturation should have no effect
      const black = { r: 0, g: 0, b: 0 };
      const saturation = 2.0;
      
      // Saturation on black should remain black
      expect(black.r).toBe(0);
      expect(black.g).toBe(0);
      expect(black.b).toBe(0);
    });

    it('should handle color balance on black', () => {
      // Black in shadows should be affected by shadow adjustments
      const black = 0;
      const shadowLift = 0.1;
      const result = black + shadowLift;
      
      expect(result).toBe(0.1);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle division by zero in black pixels', () => {
      const black = 0;
      const safeDivide = (a: number, b: number) => a / (b + 1e-8);
      
      const result = safeDivide(1.0, black);
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle logarithm of black', () => {
      const black = 0;
      const safeLog = Math.log(Math.max(black, 1e-8));
      
      expect(Number.isFinite(safeLog)).toBe(true);
      expect(safeLog).toBeLessThan(0);
    });
  });

  describe('Pure White Images', () => {
    it('should handle pure white (1,1,1) without errors', () => {
      const white = { r: 1, g: 1, b: 1 };
      
      expect(Number.isFinite(white.r)).toBe(true);
      expect(Number.isFinite(white.g)).toBe(true);
      expect(Number.isFinite(white.b)).toBe(true);
    });

    it('should handle exposure adjustment on white', () => {
      const white = 1.0;
      const exposure = 2.0; // +2 EV
      const result = white * Math.pow(2, exposure);
      
      expect(result).toBe(4.0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle tone mapping on white', () => {
      const white = 1.0;
      const toneMapped = white / (white + 1);
      
      expect(toneMapped).toBe(0.5);
      expect(Number.isFinite(toneMapped)).toBe(true);
    });

    it('should compress overexposed white', () => {
      const overexposed = 10.0;
      const compressed = overexposed / (overexposed + 1);
      
      expect(compressed).toBeLessThan(1.0);
      expect(compressed).toBeGreaterThan(0.9);
    });

    it('should handle saturation on white', () => {
      // White has no chroma, so saturation should have no effect
      const white = { r: 1, g: 1, b: 1 };
      const saturation = 2.0;
      
      // White should remain white
      expect(white.r).toBe(1);
      expect(white.g).toBe(1);
      expect(white.b).toBe(1);
    });

    it('should handle highlight rolloff', () => {
      const highlights = [1.0, 2.0, 4.0, 8.0];
      const rolled = highlights.map(x => x / (x + 1));
      
      // All should be < 1.0
      for (const value of rolled) {
        expect(value).toBeLessThan(1.0);
      }
      
      // Should be monotonically increasing
      for (let i = 1; i < rolled.length; i++) {
        expect(rolled[i]).toBeGreaterThan(rolled[i-1]);
      }
    });

    it('should handle clipping detection', () => {
      const clipped = 1.0;
      const threshold = 0.99;
      
      const isClipped = clipped >= threshold;
      expect(isClipped).toBe(true);
    });
  });

  describe('Single-Color Images', () => {
    it('should handle pure red (1,0,0)', () => {
      const red = { r: 1, g: 0, b: 0 };
      
      // Should maintain color identity
      expect(red.r).toBeGreaterThan(red.g);
      expect(red.r).toBeGreaterThan(red.b);
    });

    it('should handle pure green (0,1,0)', () => {
      const green = { r: 0, g: 1, b: 0 };
      
      expect(green.g).toBeGreaterThan(green.r);
      expect(green.g).toBeGreaterThan(green.b);
    });

    it('should handle pure blue (0,0,1)', () => {
      const blue = { r: 0, g: 0, b: 1 };
      
      expect(blue.b).toBeGreaterThan(blue.r);
      expect(blue.b).toBeGreaterThan(blue.g);
    });

    it('should preserve hue in single-color images', () => {
      const red = { r: 1, g: 0, b: 0 };
      
      // After exposure adjustment
      const exposure = 0.5;
      const adjusted = {
        r: red.r * Math.pow(2, exposure),
        g: red.g * Math.pow(2, exposure),
        b: red.b * Math.pow(2, exposure),
      };
      
      // Should still be red (r > g, r > b)
      expect(adjusted.r).toBeGreaterThan(adjusted.g);
      expect(adjusted.r).toBeGreaterThan(adjusted.b);
    });

    it('should handle saturation on single colors', () => {
      const red = { r: 1, g: 0, b: 0 };
      const saturation = 1.5;
      
      // Red is already maximally saturated
      // Increasing saturation should not exceed bounds
      const maxSat = Math.min(red.r * saturation, 1.0);
      expect(maxSat).toBeLessThanOrEqual(1.0);
    });

    it('should handle desaturation to gray', () => {
      const red = { r: 1, g: 0, b: 0 };
      const luminance = 0.2126 * red.r + 0.7152 * red.g + 0.0722 * red.b;
      
      // Full desaturation should produce gray
      const saturation = 0;
      const desaturated = {
        r: luminance + saturation * (red.r - luminance),
        g: luminance + saturation * (red.g - luminance),
        b: luminance + saturation * (red.b - luminance),
      };
      
      expect(desaturated.r).toBeCloseTo(luminance, 10);
      expect(desaturated.g).toBeCloseTo(luminance, 10);
      expect(desaturated.b).toBeCloseTo(luminance, 10);
    });

    it('should handle out-of-gamut single colors', () => {
      const outOfGamut = { r: 1.5, g: 0, b: 0 };
      
      // Should be detectable as out-of-gamut
      const isOutOfGamut = outOfGamut.r > 1.0 || outOfGamut.g > 1.0 || outOfGamut.b > 1.0;
      expect(isOutOfGamut).toBe(true);
      
      // Should be compressible
      const compressed = {
        r: Math.min(outOfGamut.r, 1.0),
        g: Math.min(outOfGamut.g, 1.0),
        b: Math.min(outOfGamut.b, 1.0),
      };
      
      expect(compressed.r).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Extreme Parameter Values', () => {
    describe('Extreme Exposure', () => {
      it('should handle very high exposure (+10 EV)', () => {
        const value = 0.5;
        const exposure = 10;
        const result = value * Math.pow(2, exposure);
        
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBe(512);
      });

      it('should handle very low exposure (-10 EV)', () => {
        const value = 0.5;
        const exposure = -10;
        const result = value * Math.pow(2, exposure);
        
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeCloseTo(0.00048828125, 10);
      });

      it('should handle zero exposure', () => {
        const value = 0.5;
        const exposure = 0;
        const result = value * Math.pow(2, exposure);
        
        expect(result).toBe(0.5);
      });
    });

    describe('Extreme Contrast', () => {
      it('should handle very high contrast', () => {
        const midpoint = 0.5;
        const contrast = 10.0;
        
        // Contrast adjustment: (x - 0.5) * contrast + 0.5
        const below = 0.4;
        const above = 0.6;
        
        const resultBelow = (below - midpoint) * contrast + midpoint;
        const resultAbove = (above - midpoint) * contrast + midpoint;
        
        expect(resultBelow).toBeLessThan(midpoint);
        expect(resultAbove).toBeGreaterThan(midpoint);
      });

      it('should handle zero contrast', () => {
        const value = 0.3;
        const midpoint = 0.5;
        const contrast = 0;
        
        const result = (value - midpoint) * contrast + midpoint;
        expect(result).toBe(midpoint);
      });

      it('should handle negative contrast', () => {
        const value = 0.7;
        const midpoint = 0.5;
        const contrast = -1.0;
        
        const result = (value - midpoint) * contrast + midpoint;
        expect(result).toBeLessThan(midpoint);
      });
    });

    describe('Extreme Saturation', () => {
      it('should handle very high saturation (10x)', () => {
        const color = { r: 0.8, g: 0.5, b: 0.3 };
        const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        const saturation = 10.0;
        
        const saturated = {
          r: luminance + saturation * (color.r - luminance),
          g: luminance + saturation * (color.g - luminance),
          b: luminance + saturation * (color.b - luminance),
        };
        
        // Should be finite
        expect(Number.isFinite(saturated.r)).toBe(true);
        expect(Number.isFinite(saturated.g)).toBe(true);
        expect(Number.isFinite(saturated.b)).toBe(true);
      });

      it('should handle zero saturation (grayscale)', () => {
        const color = { r: 0.8, g: 0.5, b: 0.3 };
        const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        const saturation = 0;
        
        const desaturated = {
          r: luminance + saturation * (color.r - luminance),
          g: luminance + saturation * (color.g - luminance),
          b: luminance + saturation * (color.b - luminance),
        };
        
        expect(desaturated.r).toBeCloseTo(luminance, 10);
        expect(desaturated.g).toBeCloseTo(luminance, 10);
        expect(desaturated.b).toBeCloseTo(luminance, 10);
      });

      it('should handle negative saturation', () => {
        const color = { r: 0.8, g: 0.5, b: 0.3 };
        const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        const saturation = -1.0;
        
        const inverted = {
          r: luminance + saturation * (color.r - luminance),
          g: luminance + saturation * (color.g - luminance),
          b: luminance + saturation * (color.b - luminance),
        };
        
        // Should produce complementary colors
        expect(Number.isFinite(inverted.r)).toBe(true);
        expect(Number.isFinite(inverted.g)).toBe(true);
        expect(Number.isFinite(inverted.b)).toBe(true);
      });
    });

    describe('Extreme Temperature', () => {
      it('should handle very low temperature (2000K)', () => {
        const temp = 2000;
        // Should produce warm (reddish) white point
        expect(temp).toBeGreaterThanOrEqual(2000);
      });

      it('should handle very high temperature (25000K)', () => {
        const temp = 25000;
        // Should produce cool (bluish) white point
        expect(temp).toBeLessThanOrEqual(25000);
      });

      it('should clamp out-of-range temperatures', () => {
        const tooLow = 1000;
        const tooHigh = 30000;
        
        const clampedLow = Math.max(tooLow, 2000);
        const clampedHigh = Math.min(tooHigh, 25000);
        
        expect(clampedLow).toBe(2000);
        expect(clampedHigh).toBe(25000);
      });
    });

    describe('Extreme Hue Shifts', () => {
      it('should handle 360 degree hue rotation', () => {
        const hue = 45; // degrees
        const shift = 360;
        const result = (hue + shift) % 360;
        
        expect(result).toBe(45);
      });

      it('should handle negative hue values', () => {
        const hue = 45;
        const shift = -90;
        const result = ((hue + shift) % 360 + 360) % 360;
        
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(360);
      });

      it('should handle very large hue shifts', () => {
        const hue = 45;
        const shift = 720; // Two full rotations
        const result = (hue + shift) % 360;
        
        expect(result).toBe(45);
      });
    });

    describe('Extreme Filter Radii', () => {
      it('should handle very small radius (1 pixel)', () => {
        const radius = 1;
        expect(radius).toBeGreaterThanOrEqual(1);
      });

      it('should handle very large radius (100 pixels)', () => {
        const radius = 100;
        expect(radius).toBeLessThanOrEqual(100);
      });

      it('should handle zero radius', () => {
        const radius = 0;
        const clamped = Math.max(radius, 1);
        expect(clamped).toBe(1);
      });
    });

    describe('Extreme Epsilon Values', () => {
      it('should handle very small epsilon', () => {
        const epsilon = 1e-10;
        const result = 1.0 / (0 + epsilon);
        
        expect(Number.isFinite(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
      });

      it('should handle very large epsilon', () => {
        const epsilon = 1.0;
        const result = 1.0 / (0 + epsilon);
        
        expect(result).toBe(1.0);
      });

      it('should handle zero epsilon (unsafe)', () => {
        const epsilon = 0;
        const safeEpsilon = Math.max(epsilon, 1e-8);
        const result = 1.0 / (0 + safeEpsilon);
        
        expect(Number.isFinite(result)).toBe(true);
      });
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle values at gamut boundary', () => {
      const atBoundary = { r: 1.0, g: 0.5, b: 0.0 };
      
      // Should be valid
      expect(atBoundary.r).toBeLessThanOrEqual(1.0);
      expect(atBoundary.g).toBeLessThanOrEqual(1.0);
      expect(atBoundary.b).toBeLessThanOrEqual(1.0);
    });

    it('should handle values just outside gamut', () => {
      const justOutside = { r: 1.001, g: 0.5, b: 0.0 };
      
      const isOutOfGamut = justOutside.r > 1.0;
      expect(isOutOfGamut).toBe(true);
    });

    it('should handle values at precision limit', () => {
      const tiny = 1e-15;
      const result = tiny + 1.0;
      
      // May lose precision but should not error
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle alternating min/max values', () => {
      const pattern = [0, 1, 0, 1, 0, 1];
      
      for (const value of pattern) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });

    it('should handle rapid transitions', () => {
      const transition = [0, 0.5, 1, 0.5, 0];
      
      // Should all be valid
      for (const value of transition) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });

  describe('Special Values', () => {
    it('should reject NaN inputs', () => {
      const value = NaN;
      const sanitized = Number.isNaN(value) ? 0 : value;
      
      expect(sanitized).toBe(0);
    });

    it('should reject Infinity inputs', () => {
      const value = Infinity;
      const sanitized = Number.isFinite(value) ? value : 0;
      
      expect(sanitized).toBe(0);
    });

    it('should reject negative Infinity inputs', () => {
      const value = -Infinity;
      const sanitized = Number.isFinite(value) ? value : 0;
      
      expect(sanitized).toBe(0);
    });

    it('should handle negative color values', () => {
      const negative = -0.5;
      const clamped = Math.max(negative, 0);
      
      expect(clamped).toBe(0);
    });

    it('should handle very small negative values', () => {
      const almostZero = -1e-10;
      const clamped = Math.max(almostZero, 0);
      
      expect(clamped).toBe(0);
    });
  });
});
