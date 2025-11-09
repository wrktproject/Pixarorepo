/**
 * Comprehensive Color Space Conversion Tests
 * Tests accuracy of sRGB/Linear conversions using pow(2.2) approximation
 * Note: Current implementation uses fast pow(2.2) approximation instead of accurate sRGB transfer function
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect } from 'vitest';
import { srgbToLinear, linearToSrgb } from './colorUtils';

describe('Color Space Conversion Accuracy', () => {
  describe('sRGB to Linear - pow(2.2) Approximation', () => {
    // Reference values using pow(2.2) approximation
    const referenceValues = [
      { srgb: 0.0, linear: 0.0 },
      { srgb: 0.1, linear: Math.pow(0.1, 2.2) },
      { srgb: 0.2, linear: Math.pow(0.2, 2.2) },
      { srgb: 0.3, linear: Math.pow(0.3, 2.2) },
      { srgb: 0.4, linear: Math.pow(0.4, 2.2) },
      { srgb: 0.5, linear: Math.pow(0.5, 2.2) },
      { srgb: 0.6, linear: Math.pow(0.6, 2.2) },
      { srgb: 0.7, linear: Math.pow(0.7, 2.2) },
      { srgb: 0.8, linear: Math.pow(0.8, 2.2) },
      { srgb: 0.9, linear: Math.pow(0.9, 2.2) },
      { srgb: 1.0, linear: 1.0 },
    ];

    referenceValues.forEach(({ srgb, linear }) => {
      it(`should convert ${srgb.toFixed(1)} to ${linear.toFixed(6)}`, () => {
        const result = srgbToLinear(srgb);
        expect(result).toBeCloseTo(linear, 6);
      });
    });
  });

  describe('Linear to sRGB - pow(1/2.2) Approximation', () => {
    const referenceValues = [
      { linear: 0.0, srgb: 0.0 },
      { linear: 0.01, srgb: Math.pow(0.01, 1.0 / 2.2) },
      { linear: 0.05, srgb: Math.pow(0.05, 1.0 / 2.2) },
      { linear: 0.1, srgb: Math.pow(0.1, 1.0 / 2.2) },
      { linear: 0.2, srgb: Math.pow(0.2, 1.0 / 2.2) },
      { linear: 0.3, srgb: Math.pow(0.3, 1.0 / 2.2) },
      { linear: 0.5, srgb: Math.pow(0.5, 1.0 / 2.2) },
      { linear: 0.7, srgb: Math.pow(0.7, 1.0 / 2.2) },
      { linear: 1.0, srgb: 1.0 },
    ];

    referenceValues.forEach(({ linear, srgb }) => {
      it(`should convert ${linear.toFixed(2)} to ${srgb.toFixed(6)}`, () => {
        const result = linearToSrgb(linear);
        expect(result).toBeCloseTo(srgb, 6);
      });
    });
  });

  describe('Round-trip Conversion Accuracy', () => {
    it('should maintain accuracy through multiple conversions', () => {
      const testValues = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];

      testValues.forEach((original) => {
        // sRGB -> Linear -> sRGB
        const linear = srgbToLinear(original);
        const backToSrgb = linearToSrgb(linear);
        expect(backToSrgb).toBeCloseTo(original, 5);

        // Linear -> sRGB -> Linear
        const srgb = linearToSrgb(original);
        const backToLinear = srgbToLinear(srgb);
        expect(backToLinear).toBeCloseTo(original, 5);
      });
    });

    it('should handle edge cases correctly', () => {
      // Pure black
      expect(srgbToLinear(0.0)).toBe(0.0);
      expect(linearToSrgb(0.0)).toBe(0.0);

      // Pure white
      expect(srgbToLinear(1.0)).toBe(1.0);
      expect(linearToSrgb(1.0)).toBe(1.0);

      // Mid-gray (18% gray card)
      const midGray = 0.18;
      const linear = srgbToLinear(midGray);
      const back = linearToSrgb(linear);
      expect(back).toBeCloseTo(midGray, 5);
    });
  });

  describe('Color Space Conversion - RGB Vectors', () => {
    it('should convert pure red correctly', () => {
      const srgbRed = { r: 1.0, g: 0.0, b: 0.0 };
      const linearR = srgbToLinear(srgbRed.r);
      const linearG = srgbToLinear(srgbRed.g);
      const linearB = srgbToLinear(srgbRed.b);

      expect(linearR).toBe(1.0);
      expect(linearG).toBe(0.0);
      expect(linearB).toBe(0.0);
    });

    it('should convert pure green correctly', () => {
      const srgbGreen = { r: 0.0, g: 1.0, b: 0.0 };
      const linearR = srgbToLinear(srgbGreen.r);
      const linearG = srgbToLinear(srgbGreen.g);
      const linearB = srgbToLinear(srgbGreen.b);

      expect(linearR).toBe(0.0);
      expect(linearG).toBe(1.0);
      expect(linearB).toBe(0.0);
    });

    it('should convert pure blue correctly', () => {
      const srgbBlue = { r: 0.0, g: 0.0, b: 1.0 };
      const linearR = srgbToLinear(srgbBlue.r);
      const linearG = srgbToLinear(srgbBlue.g);
      const linearB = srgbToLinear(srgbBlue.b);

      expect(linearR).toBe(0.0);
      expect(linearG).toBe(0.0);
      expect(linearB).toBe(1.0);
    });

    it('should convert neutral gray correctly', () => {
      const gray = 0.5;
      const linear = srgbToLinear(gray);
      
      // 50% sRGB gray should be approximately 21.4% linear
      expect(linear).toBeCloseTo(0.214, 2);
    });
  });
});
