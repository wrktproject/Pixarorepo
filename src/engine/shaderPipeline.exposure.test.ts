/**
 * Exposure and Tone Mapping Tests
 * Validates photographic exposure behavior and tone mapping accuracy
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect } from 'vitest';
import { srgbToLinear, linearToSrgb } from './colorUtils';

describe('Exposure Adjustments', () => {
  describe('Photographic Stops Behavior', () => {
    it('should double brightness for +1 stop in linear space', () => {
      const originalLinear = 0.5;
      const exposureStops = 1.0;
      
      const adjusted = originalLinear * Math.pow(2.0, exposureStops);
      
      expect(adjusted).toBeCloseTo(1.0, 5);
    });

    it('should halve brightness for -1 stop in linear space', () => {
      const originalLinear = 0.5;
      const exposureStops = -1.0;
      
      const adjusted = originalLinear * Math.pow(2.0, exposureStops);
      
      expect(adjusted).toBeCloseTo(0.25, 5);
    });

    it('should quadruple brightness for +2 stops', () => {
      const originalLinear = 0.25;
      const exposureStops = 2.0;
      
      const adjusted = originalLinear * Math.pow(2.0, exposureStops);
      
      expect(adjusted).toBeCloseTo(1.0, 5);
    });

    it('should preserve color ratios when adjusting exposure', () => {
      const color = { r: 0.8, g: 0.4, b: 0.2 };
      const exposureStops = 1.0;
      const multiplier = Math.pow(2.0, exposureStops);
      
      const adjusted = {
        r: color.r * multiplier,
        g: color.g * multiplier,
        b: color.b * multiplier,
      };
      
      // Ratios should be preserved
      const originalRatio = color.r / color.g;
      const adjustedRatio = adjusted.r / adjusted.g;
      
      expect(adjustedRatio).toBeCloseTo(originalRatio, 5);
    });
  });

  describe('Exposure in sRGB vs Linear', () => {
    it('should produce different results in sRGB vs linear space', () => {
      const srgbValue = 0.5;
      const exposureStops = 1.0;
      
      // Wrong: applying exposure in sRGB space
      const wrongResult = srgbValue * Math.pow(2.0, exposureStops);
      
      // Correct: convert to linear, apply exposure, convert back
      const linear = srgbToLinear(srgbValue);
      const adjustedLinear = linear * Math.pow(2.0, exposureStops);
      const correctResult = linearToSrgb(adjustedLinear);
      
      // Results should be different
      expect(wrongResult).not.toBeCloseTo(correctResult, 2);
      
      // Correct result should be brighter (higher value)
      expect(correctResult).toBeGreaterThan(wrongResult);
    });

    it('should maintain photographic accuracy in linear space', () => {
      // 18% gray card (middle gray in photography)
      const midGray = 0.18;
      
      // +1 stop should make it 36%
      const onceExposed = midGray * Math.pow(2.0, 1.0);
      expect(onceExposed).toBeCloseTo(0.36, 5);
      
      // +2 stops should make it 72%
      const twiceExposed = midGray * Math.pow(2.0, 2.0);
      expect(twiceExposed).toBeCloseTo(0.72, 5);
    });
  });

  describe('Exposure Edge Cases', () => {
    it('should handle zero exposure (no change)', () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0];
      const exposureStops = 0.0;
      
      values.forEach((value) => {
        const adjusted = value * Math.pow(2.0, exposureStops);
        expect(adjusted).toBeCloseTo(value, 5);
      });
    });

    it('should handle extreme positive exposure', () => {
      const value = 0.1;
      const exposureStops = 5.0; // +5 stops
      
      const adjusted = value * Math.pow(2.0, exposureStops);
      
      // 0.1 * 2^5 = 0.1 * 32 = 3.2 (will be clamped to 1.0 in shader)
      expect(adjusted).toBeCloseTo(3.2, 5);
    });

    it('should handle extreme negative exposure', () => {
      const value = 0.5;
      const exposureStops = -5.0; // -5 stops
      
      const adjusted = value * Math.pow(2.0, exposureStops);
      
      // 0.5 * 2^-5 = 0.5 / 32 = 0.015625
      expect(adjusted).toBeCloseTo(0.015625, 5);
    });
  });
});

describe('Tone Mapping', () => {
  describe('Reinhard Tone Mapping', () => {
    const reinhardToneMap = (value: number): number => {
      return value / (value + 1.0);
    };

    it('should compress HDR values to displayable range', () => {
      const hdrValues = [1.5, 2.0, 5.0, 10.0, 100.0];
      
      hdrValues.forEach((hdr) => {
        const mapped = reinhardToneMap(hdr);
        expect(mapped).toBeGreaterThan(0);
        expect(mapped).toBeLessThan(1.0);
      });
    });

    it('should preserve values below 1.0', () => {
      const ldrValues = [0.0, 0.25, 0.5, 0.75, 1.0];
      
      ldrValues.forEach((ldr) => {
        const mapped = reinhardToneMap(ldr);
        expect(mapped).toBeCloseTo(ldr, 1);
      });
    });

    it('should map 1.0 to 0.5', () => {
      const mapped = reinhardToneMap(1.0);
      expect(mapped).toBeCloseTo(0.5, 5);
    });

    it('should asymptotically approach 1.0 for high values', () => {
      const veryHigh = 1000.0;
      const mapped = reinhardToneMap(veryHigh);
      
      expect(mapped).toBeGreaterThan(0.999);
      expect(mapped).toBeLessThan(1.0);
    });

    it('should be monotonically increasing', () => {
      const values = [0.0, 0.5, 1.0, 2.0, 5.0, 10.0];
      
      for (let i = 1; i < values.length; i++) {
        const prev = reinhardToneMap(values[i - 1]);
        const curr = reinhardToneMap(values[i]);
        expect(curr).toBeGreaterThan(prev);
      }
    });
  });

  describe('ACES Filmic Tone Mapping', () => {
    const acesToneMap = (value: number): number => {
      const a = 2.51;
      const b = 0.03;
      const c = 2.43;
      const d = 0.59;
      const e = 0.14;
      
      const result = (value * (a * value + b)) / (value * (c * value + d) + e);
      return Math.max(0.0, Math.min(1.0, result));
    };

    it('should compress HDR values with filmic curve', () => {
      const hdrValues = [1.5, 2.0, 3.0, 5.0];
      
      hdrValues.forEach((hdr) => {
        const mapped = acesToneMap(hdr);
        expect(mapped).toBeGreaterThan(0);
        expect(mapped).toBeLessThanOrEqual(1.0);
      });
    });

    it('should produce different curve than Reinhard', () => {
      const reinhardToneMap = (v: number) => v / (v + 1.0);
      
      const testValue = 2.0;
      const reinhard = reinhardToneMap(testValue);
      const aces = acesToneMap(testValue);
      
      // ACES should produce different results
      expect(Math.abs(aces - reinhard)).toBeGreaterThan(0.01);
    });

    it('should handle black correctly', () => {
      const mapped = acesToneMap(0.0);
      expect(mapped).toBeCloseTo(0.0, 5);
    });
  });

  describe('Tone Mapping Application Order', () => {
    it('should apply tone mapping after all adjustments but before sRGB conversion', () => {
      // Simulate pipeline order
      const srgbInput = 0.8;
      const exposureStops = 2.0;
      
      // 1. Convert to linear
      const linear = srgbToLinear(srgbInput);
      
      // 2. Apply exposure (may exceed 1.0)
      const exposed = linear * Math.pow(2.0, exposureStops);
      
      // 3. Apply tone mapping (compress to 0-1 range)
      const toneMapped = exposed / (exposed + 1.0);
      
      // 4. Convert to sRGB
      const output = linearToSrgb(toneMapped);
      
      // Output should be valid
      expect(output).toBeGreaterThanOrEqual(0);
      expect(output).toBeLessThanOrEqual(1.0);
      
      // Without tone mapping, we'd have clipping
      const withoutToneMapping = linearToSrgb(Math.min(exposed, 1.0));
      expect(output).not.toBeCloseTo(withoutToneMapping, 2);
    });
  });
});

describe('Contrast Adjustments', () => {
  describe('Contrast Around Midpoint', () => {
    const applyContrast = (value: number, contrast: number): number => {
      return (value - 0.5) * contrast + 0.5;
    };

    it('should expand tonal range when contrast > 1.0', () => {
      const midGray = 0.5;
      const darkGray = 0.3;
      const lightGray = 0.7;
      const contrast = 1.5;
      
      // Midpoint should stay the same
      expect(applyContrast(midGray, contrast)).toBeCloseTo(0.5, 5);
      
      // Dark values should get darker
      const adjustedDark = applyContrast(darkGray, contrast);
      expect(adjustedDark).toBeLessThan(darkGray);
      
      // Light values should get lighter
      const adjustedLight = applyContrast(lightGray, contrast);
      expect(adjustedLight).toBeGreaterThan(lightGray);
    });

    it('should compress tonal range when contrast < 1.0', () => {
      const darkGray = 0.2;
      const lightGray = 0.8;
      const contrast = 0.5;
      
      // Dark values should get lighter
      const adjustedDark = applyContrast(darkGray, contrast);
      expect(adjustedDark).toBeGreaterThan(darkGray);
      
      // Light values should get darker
      const adjustedLight = applyContrast(lightGray, contrast);
      expect(adjustedLight).toBeLessThan(lightGray);
    });

    it('should not change image when contrast = 1.0', () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0];
      const contrast = 1.0;
      
      values.forEach((value) => {
        const adjusted = applyContrast(value, contrast);
        expect(adjusted).toBeCloseTo(value, 5);
      });
    });

    it('should always keep midpoint at 0.5', () => {
      const contrasts = [0.0, 0.5, 1.0, 1.5, 2.0];
      
      contrasts.forEach((contrast) => {
        const adjusted = applyContrast(0.5, contrast);
        expect(adjusted).toBeCloseTo(0.5, 5);
      });
    });
  });
});
