import { describe, it, expect } from 'vitest';
import {
  srgbToLinear,
  linearToSrgb,
  getLuminance,
  kelvinToRGB,
  rgbToHsl,
  hslToRgb,
  getSaturation,
  clamp,
  mapAdjustmentValue,
} from './colorUtils';

describe('Color Space Conversions', () => {
  describe('srgbToLinear', () => {
    it('should convert sRGB to linear color space', () => {
      expect(srgbToLinear(0.0)).toBeCloseTo(0.0, 5);
      expect(srgbToLinear(0.5)).toBeCloseTo(0.2176, 3);
      expect(srgbToLinear(1.0)).toBeCloseTo(1.0, 5);
    });
  });

  describe('linearToSrgb', () => {
    it('should convert linear to sRGB color space', () => {
      expect(linearToSrgb(0.0)).toBeCloseTo(0.0, 5);
      expect(linearToSrgb(0.2176)).toBeCloseTo(0.5, 2);
      expect(linearToSrgb(1.0)).toBeCloseTo(1.0, 5);
    });

    it('should be inverse of srgbToLinear', () => {
      const values = [0.0, 0.25, 0.5, 0.75, 1.0];
      values.forEach((val) => {
        const linear = srgbToLinear(val);
        const back = linearToSrgb(linear);
        expect(back).toBeCloseTo(val, 5);
      });
    });
  });

  describe('getLuminance', () => {
    it('should calculate luminance correctly', () => {
      expect(getLuminance(0, 0, 0)).toBe(0);
      expect(getLuminance(1, 1, 1)).toBeCloseTo(1.0, 5);
      expect(getLuminance(1, 0, 0)).toBeCloseTo(0.2126, 4);
      expect(getLuminance(0, 1, 0)).toBeCloseTo(0.7152, 4);
      expect(getLuminance(0, 0, 1)).toBeCloseTo(0.0722, 4);
    });
  });
});

describe('Temperature Conversion', () => {
  describe('kelvinToRGB', () => {
    it('should convert neutral temperature (6500K) to near white', () => {
      const result = kelvinToRGB(6500);
      expect(result.r).toBeCloseTo(1.0, 1);
      expect(result.g).toBeCloseTo(1.0, 1);
      expect(result.b).toBeCloseTo(1.0, 1);
    });

    it('should convert warm temperature (3000K) to orange-ish', () => {
      const result = kelvinToRGB(3000);
      expect(result.r).toBe(1.0);
      expect(result.g).toBeLessThan(1.0);
      expect(result.b).toBeLessThan(result.g);
    });

    it('should convert cool temperature (10000K) to blue-ish', () => {
      const result = kelvinToRGB(10000);
      expect(result.b).toBe(1.0);
      expect(result.r).toBeLessThan(1.0);
    });

    it('should clamp values between 0 and 1', () => {
      const temps = [2000, 5000, 10000, 20000];
      temps.forEach((temp) => {
        const result = kelvinToRGB(temp);
        expect(result.r).toBeGreaterThanOrEqual(0);
        expect(result.r).toBeLessThanOrEqual(1);
        expect(result.g).toBeGreaterThanOrEqual(0);
        expect(result.g).toBeLessThanOrEqual(1);
        expect(result.b).toBeGreaterThanOrEqual(0);
        expect(result.b).toBeLessThanOrEqual(1);
      });
    });
  });
});

describe('HSL Conversions', () => {
  describe('rgbToHsl', () => {
    it('should convert pure red correctly', () => {
      const result = rgbToHsl(1, 0, 0);
      expect(result.h).toBeCloseTo(0, 2);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('should convert pure green correctly', () => {
      const result = rgbToHsl(0, 1, 0);
      expect(result.h).toBeCloseTo(0.333, 2);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('should convert pure blue correctly', () => {
      const result = rgbToHsl(0, 0, 1);
      expect(result.h).toBeCloseTo(0.667, 2);
      expect(result.s).toBeCloseTo(1, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });

    it('should convert grayscale correctly', () => {
      const result = rgbToHsl(0.5, 0.5, 0.5);
      expect(result.s).toBeCloseTo(0, 2);
      expect(result.l).toBeCloseTo(0.5, 2);
    });
  });

  describe('hslToRgb', () => {
    it('should convert hue 0 (red) correctly', () => {
      const result = hslToRgb(0, 1, 0.5);
      expect(result.r).toBeCloseTo(1, 2);
      expect(result.g).toBeCloseTo(0, 2);
      expect(result.b).toBeCloseTo(0, 2);
    });

    it('should convert hue 0.333 (green) correctly', () => {
      const result = hslToRgb(0.333, 1, 0.5);
      expect(result.r).toBeCloseTo(0, 1);
      expect(result.g).toBeCloseTo(1, 1);
      expect(result.b).toBeCloseTo(0, 1);
    });

    it('should convert grayscale correctly', () => {
      const result = hslToRgb(0, 0, 0.5);
      expect(result.r).toBeCloseTo(0.5, 2);
      expect(result.g).toBeCloseTo(0.5, 2);
      expect(result.b).toBeCloseTo(0.5, 2);
    });

    it('should be inverse of rgbToHsl', () => {
      const colors = [
        { r: 1, g: 0, b: 0 },
        { r: 0, g: 1, b: 0 },
        { r: 0, g: 0, b: 1 },
        { r: 0.5, g: 0.5, b: 0.5 },
        { r: 1, g: 0.5, b: 0.25 },
      ];

      colors.forEach((color) => {
        const hsl = rgbToHsl(color.r, color.g, color.b);
        const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
        expect(rgb.r).toBeCloseTo(color.r, 2);
        expect(rgb.g).toBeCloseTo(color.g, 2);
        expect(rgb.b).toBeCloseTo(color.b, 2);
      });
    });
  });
});

describe('Saturation Calculation', () => {
  describe('getSaturation', () => {
    it('should return 0 for grayscale', () => {
      expect(getSaturation(0.5, 0.5, 0.5)).toBe(0);
      expect(getSaturation(0, 0, 0)).toBe(0);
      expect(getSaturation(1, 1, 1)).toBe(0);
    });

    it('should return 1 for fully saturated colors', () => {
      expect(getSaturation(1, 0, 0)).toBe(1);
      expect(getSaturation(0, 1, 0)).toBe(1);
      expect(getSaturation(0, 0, 1)).toBe(1);
    });

    it('should return values between 0 and 1 for partially saturated colors', () => {
      const sat = getSaturation(1, 0.5, 0.5);
      expect(sat).toBeGreaterThan(0);
      expect(sat).toBeLessThan(1);
    });
  });
});

describe('Utility Functions', () => {
  describe('clamp', () => {
    it('should clamp values below minimum', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp values above maximum', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should not modify values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });

  describe('mapAdjustmentValue', () => {
    it('should map values from one range to another', () => {
      expect(mapAdjustmentValue(0, -100, 100, 0, 1)).toBeCloseTo(0.5, 5);
      expect(mapAdjustmentValue(-100, -100, 100, 0, 1)).toBeCloseTo(0, 5);
      expect(mapAdjustmentValue(100, -100, 100, 0, 1)).toBeCloseTo(1, 5);
    });

    it('should handle different ranges', () => {
      expect(mapAdjustmentValue(50, 0, 100, -1, 1)).toBeCloseTo(0, 5);
      expect(mapAdjustmentValue(0, 0, 100, -1, 1)).toBeCloseTo(-1, 5);
      expect(mapAdjustmentValue(100, 0, 100, -1, 1)).toBeCloseTo(1, 5);
    });
  });
});
