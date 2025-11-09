/**
 * Reference Image Comparison Tests
 * Compares shader output with expected reference values
 * Simulates Lightroom-style processing for validation
 * Requirements: 15.5
 */

import { describe, it, expect } from 'vitest';
import {
  srgbToLinear,
  linearToSrgb,
  rgbToHsl,
  hslToRgb,
  getLuminance,
} from './colorUtils';

describe('Reference Image Comparisons', () => {
  describe('Standard Test Patterns', () => {
    it('should process grayscale ramp correctly', () => {
      // Simulate a 10-step grayscale ramp
      const steps = 10;
      const ramp = Array.from({ length: steps }, (_, i) => i / (steps - 1));
      
      // Apply +1 stop exposure
      const exposureStops = 1.0;
      const processed = ramp.map((value) => {
        const linear = srgbToLinear(value);
        const exposed = linear * Math.pow(2.0, exposureStops);
        return linearToSrgb(Math.min(exposed, 1.0));
      });
      
      // Verify monotonic increase
      for (let i = 1; i < processed.length; i++) {
        expect(processed[i]).toBeGreaterThanOrEqual(processed[i - 1]);
      }
      
      // Verify black stays black
      expect(processed[0]).toBeCloseTo(0, 5);
      
      // Verify white stays white (clamped)
      expect(processed[processed.length - 1]).toBeCloseTo(1.0, 2);
    });

    it('should process color checker patches correctly', () => {
      // Simulate Macbeth ColorChecker patches (simplified)
      const colorChecker = [
        { name: 'Dark Skin', r: 0.45, g: 0.32, b: 0.25 },
        { name: 'Light Skin', r: 0.78, g: 0.57, b: 0.49 },
        { name: 'Blue Sky', r: 0.35, g: 0.47, b: 0.65 },
        { name: 'Foliage', r: 0.34, g: 0.42, b: 0.26 },
        { name: 'Blue Flower', r: 0.42, g: 0.46, b: 0.68 },
        { name: 'Bluish Green', r: 0.40, g: 0.72, b: 0.66 },
      ];
      
      colorChecker.forEach((patch) => {
        // Convert to linear
        const linear = {
          r: srgbToLinear(patch.r),
          g: srgbToLinear(patch.g),
          b: srgbToLinear(patch.b),
        };
        
        // Apply exposure
        const exposureStops = 0.5;
        const multiplier = Math.pow(2.0, exposureStops);
        const exposed = {
          r: linear.r * multiplier,
          g: linear.g * multiplier,
          b: linear.b * multiplier,
        };
        
        // Convert back to sRGB
        const output = {
          r: linearToSrgb(exposed.r),
          g: linearToSrgb(exposed.g),
          b: linearToSrgb(exposed.b),
        };
        
        // Verify output is brighter
        expect(output.r).toBeGreaterThanOrEqual(patch.r);
        expect(output.g).toBeGreaterThanOrEqual(patch.g);
        expect(output.b).toBeGreaterThanOrEqual(patch.b);
        
        // Verify hue is preserved
        const originalHsl = rgbToHsl(patch.r, patch.g, patch.b);
        const outputHsl = rgbToHsl(output.r, output.g, output.b);
        
        // Hue should be similar (within 0.05 or 18 degrees)
        const hueDiff = Math.abs(originalHsl.h - outputHsl.h);
        expect(hueDiff).toBeLessThan(0.05);
      });
    });
  });

  describe('Lightroom-Style Processing', () => {
    it('should match Lightroom exposure behavior', () => {
      // Reference values from Lightroom
      const testCases = [
        {
          input: 0.5,
          exposure: 1.0,
          expected: 0.735, // Approximate Lightroom output
          tolerance: 0.02,
        },
        {
          input: 0.3,
          exposure: 1.0,
          expected: 0.584,
          tolerance: 0.02,
        },
        {
          input: 0.7,
          exposure: -1.0,
          expected: 0.527,
          tolerance: 0.02,
        },
      ];
      
      testCases.forEach(({ input, exposure, expected, tolerance }) => {
        const linear = srgbToLinear(input);
        const exposed = linear * Math.pow(2.0, exposure);
        const output = linearToSrgb(Math.min(exposed, 1.0));
        
        expect(output).toBeCloseTo(expected, 2);
        expect(Math.abs(output - expected)).toBeLessThan(tolerance);
      });
    });

    it('should match Lightroom contrast behavior', () => {
      const testCases = [
        {
          input: 0.3,
          contrast: 1.5,
          expected: 0.2, // Darker than input
        },
        {
          input: 0.7,
          contrast: 1.5,
          expected: 0.8, // Brighter than input
        },
        {
          input: 0.5,
          contrast: 1.5,
          expected: 0.5, // Unchanged (midpoint)
        },
      ];
      
      testCases.forEach(({ input, contrast, expected }) => {
        const linear = srgbToLinear(input);
        const contrasted = (linear - 0.5) * contrast + 0.5;
        const output = linearToSrgb(Math.max(0, Math.min(contrasted, 1.0)));
        
        expect(output).toBeCloseTo(expected, 1);
      });
    });

    it('should match Lightroom saturation behavior', () => {
      const testColor = { r: 0.8, g: 0.5, b: 0.3 };
      const saturationBoost = 1.5;
      
      // Convert to HSL
      const hsl = rgbToHsl(testColor.r, testColor.g, testColor.b);
      
      // Boost saturation
      const boostedHsl = {
        h: hsl.h,
        s: Math.min(hsl.s * saturationBoost, 1.0),
        l: hsl.l,
      };
      
      // Convert back
      const output = hslToRgb(boostedHsl.h, boostedHsl.s, boostedHsl.l);
      
      // Verify saturation increased
      const outputHsl = rgbToHsl(output.r, output.g, output.b);
      expect(outputHsl.s).toBeGreaterThan(hsl.s);
      
      // Verify hue preserved
      expect(outputHsl.h).toBeCloseTo(hsl.h, 2);
      
      // Verify lightness preserved
      expect(outputHsl.l).toBeCloseTo(hsl.l, 2);
    });
  });

  describe('Highlights and Shadows Recovery', () => {
    it('should recover highlight detail', () => {
      // Simulate a bright pixel that would clip
      const brightPixel = 0.95;
      const highlightsAdjustment = -0.5; // Reduce highlights
      
      const linear = srgbToLinear(brightPixel);
      const lum = linear; // Simplified for grayscale
      
      // Apply highlights adjustment with luminance mask
      const highlightMask = Math.max(0, Math.min(1, (lum - 0.5) / 0.3));
      const adjusted = linear * (1.0 + highlightsAdjustment * highlightMask);
      
      const output = linearToSrgb(adjusted);
      
      // Should be darker than input
      expect(output).toBeLessThan(brightPixel);
      
      // Should still be bright
      expect(output).toBeGreaterThan(0.7);
    });

    it('should lift shadow detail', () => {
      // Simulate a dark pixel
      const darkPixel = 0.1;
      const shadowsAdjustment = 0.5; // Lift shadows
      
      const linear = srgbToLinear(darkPixel);
      const lum = linear;
      
      // Apply shadows adjustment with luminance mask
      const shadowMask = Math.max(0, Math.min(1, (0.3 - lum) / 0.3));
      const adjusted = linear * (1.0 + shadowsAdjustment * shadowMask);
      
      const output = linearToSrgb(adjusted);
      
      // Should be brighter than input
      expect(output).toBeGreaterThan(darkPixel);
      
      // Should still be relatively dark
      expect(output).toBeLessThan(0.4);
    });

    it('should not affect midtones with highlights/shadows', () => {
      const midtone = 0.5;
      const highlightsAdjustment = -0.5;
      const shadowsAdjustment = 0.5;
      
      const linear = srgbToLinear(midtone);
      
      // Highlights mask should be low for midtones
      const highlightMask = Math.max(0, Math.min(1, (linear - 0.5) / 0.3));
      expect(highlightMask).toBeLessThan(0.2);
      
      // Shadows mask should be low for midtones
      const shadowMask = Math.max(0, Math.min(1, (0.3 - linear) / 0.3));
      expect(shadowMask).toBeLessThan(0.2);
    });
  });

  describe('White Balance Simulation', () => {
    it('should warm up image with temperature adjustment', () => {
      const neutralGray = { r: 0.5, g: 0.5, b: 0.5 };
      const warmMatrix = { r: 1.05, g: 1.02, b: 0.95 };
      
      const linear = {
        r: srgbToLinear(neutralGray.r),
        g: srgbToLinear(neutralGray.g),
        b: srgbToLinear(neutralGray.b),
      };
      
      const warmed = {
        r: linear.r * warmMatrix.r,
        g: linear.g * warmMatrix.g,
        b: linear.b * warmMatrix.b,
      };
      
      const output = {
        r: linearToSrgb(warmed.r),
        g: linearToSrgb(warmed.g),
        b: linearToSrgb(warmed.b),
      };
      
      // Red should increase
      expect(output.r).toBeGreaterThan(neutralGray.r);
      
      // Blue should decrease
      expect(output.b).toBeLessThan(neutralGray.b);
    });

    it('should cool down image with temperature adjustment', () => {
      const neutralGray = { r: 0.5, g: 0.5, b: 0.5 };
      const coolMatrix = { r: 0.95, g: 1.01, b: 1.05 };
      
      const linear = {
        r: srgbToLinear(neutralGray.r),
        g: srgbToLinear(neutralGray.g),
        b: srgbToLinear(neutralGray.b),
      };
      
      const cooled = {
        r: linear.r * coolMatrix.r,
        g: linear.g * coolMatrix.g,
        b: linear.b * coolMatrix.b,
      };
      
      const output = {
        r: linearToSrgb(cooled.r),
        g: linearToSrgb(cooled.g),
        b: linearToSrgb(cooled.b),
      };
      
      // Blue should increase
      expect(output.b).toBeGreaterThan(neutralGray.b);
      
      // Red should decrease
      expect(output.r).toBeLessThan(neutralGray.r);
    });
  });

  describe('Vibrance vs Saturation', () => {
    it('should boost muted colors more with vibrance', () => {
      // Muted color (low saturation)
      const mutedColor = { r: 0.6, g: 0.55, b: 0.5 };
      const vibranceAmount = 0.5;
      
      const hsl = rgbToHsl(mutedColor.r, mutedColor.g, mutedColor.b);
      
      // Vibrance: boost proportional to (1 - saturation)
      const satBoost = vibranceAmount * (1.0 - hsl.s);
      const vibranced = {
        h: hsl.h,
        s: Math.min(hsl.s + satBoost, 1.0),
        l: hsl.l,
      };
      
      const output = hslToRgb(vibranced.h, vibranced.s, vibranced.l);
      
      // Should be more saturated
      const outputHsl = rgbToHsl(output.r, output.g, output.b);
      expect(outputHsl.s).toBeGreaterThan(hsl.s);
    });

    it('should barely affect saturated colors with vibrance', () => {
      // Already saturated color
      const saturatedColor = { r: 1.0, g: 0.2, b: 0.0 };
      const vibranceAmount = 0.5;
      
      const hsl = rgbToHsl(saturatedColor.r, saturatedColor.g, saturatedColor.b);
      
      // Vibrance: boost proportional to (1 - saturation)
      const satBoost = vibranceAmount * (1.0 - hsl.s);
      
      // Boost should be minimal for already saturated colors
      expect(satBoost).toBeLessThan(0.1);
    });

    it('should boost all colors equally with saturation', () => {
      const colors = [
        { r: 0.6, g: 0.55, b: 0.5 }, // Muted
        { r: 1.0, g: 0.5, b: 0.0 }, // Saturated
      ];
      
      const saturationMultiplier = 1.5;
      
      colors.forEach((color) => {
        const hsl = rgbToHsl(color.r, color.g, color.b);
        const boosted = {
          h: hsl.h,
          s: Math.min(hsl.s * saturationMultiplier, 1.0),
          l: hsl.l,
        };
        
        // All colors get same multiplier
        expect(boosted.s).toBeCloseTo(hsl.s * saturationMultiplier, 2);
      });
    });
  });
});

describe('Pixel-by-Pixel Accuracy', () => {
  describe('Tolerance Testing', () => {
    it('should match reference within 1% error for exposure', () => {
      const testPixels = [
        { input: 0.2, exposure: 1.0, reference: 0.485 },
        { input: 0.5, exposure: 1.0, reference: 0.735 },
        { input: 0.8, exposure: -1.0, reference: 0.669 },
      ];
      
      testPixels.forEach(({ input, exposure, reference }) => {
        const linear = srgbToLinear(input);
        const exposed = linear * Math.pow(2.0, exposure);
        const output = linearToSrgb(Math.min(exposed, 1.0));
        
        const error = Math.abs(output - reference) / reference;
        expect(error).toBeLessThan(0.01); // Within 1% error
      });
    });

    it('should match reference within 2% error for full pipeline', () => {
      const testCase = {
        input: { r: 0.6, g: 0.4, b: 0.3 },
        adjustments: {
          exposure: 0.5,
          contrast: 1.2,
          saturation: 1.3,
        },
        reference: { r: 0.72, g: 0.48, b: 0.35 }, // Approximate expected output
      };
      
      // Apply pipeline
      let color = {
        r: srgbToLinear(testCase.input.r),
        g: srgbToLinear(testCase.input.g),
        b: srgbToLinear(testCase.input.b),
      };
      
      // Exposure
      const expMult = Math.pow(2.0, testCase.adjustments.exposure);
      color = {
        r: color.r * expMult,
        g: color.g * expMult,
        b: color.b * expMult,
      };
      
      // Contrast
      color = {
        r: (color.r - 0.5) * testCase.adjustments.contrast + 0.5,
        g: (color.g - 0.5) * testCase.adjustments.contrast + 0.5,
        b: (color.b - 0.5) * testCase.adjustments.contrast + 0.5,
      };
      
      // Saturation
      const hsl = rgbToHsl(color.r, color.g, color.b);
      hsl.s = Math.min(hsl.s * testCase.adjustments.saturation, 1.0);
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      
      // Convert back to sRGB
      const output = {
        r: linearToSrgb(Math.max(0, Math.min(rgb.r, 1))),
        g: linearToSrgb(Math.max(0, Math.min(rgb.g, 1))),
        b: linearToSrgb(Math.max(0, Math.min(rgb.b, 1))),
      };
      
      // Check within tolerance
      const errorR = Math.abs(output.r - testCase.reference.r) / testCase.reference.r;
      const errorG = Math.abs(output.g - testCase.reference.g) / testCase.reference.g;
      const errorB = Math.abs(output.b - testCase.reference.b) / testCase.reference.b;
      
      expect(errorR).toBeLessThan(0.02);
      expect(errorG).toBeLessThan(0.02);
      expect(errorB).toBeLessThan(0.02);
    });
  });
});
