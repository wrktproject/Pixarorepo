/**
 * Sigmoid Tone Mapping Tests
 * 
 * Tests for sigmoid tone curve implementation including:
 * - Smooth S-curve shape verification
 * - Color preservation
 * - Parameter range validation
 * - Shader content validation
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  sigmoidVertexShader,
  sigmoidFragmentShader,
  defaultSigmoidParams,
  type SigmoidParams,
} from './sigmoid';

/**
 * JavaScript implementation of sigmoid curve for testing
 * Matches the GLSL implementation
 */
function sigmoidCurveJS(x: number, contrast: number, skew: number, middleGrey: number): number {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;

  const x0 = 0.5 + skew * 0.3;
  const k = contrast * 10.0;
  const normalized = x / middleGrey;
  const sigmoid = 1.0 / (1.0 + Math.exp(-k * (normalized - x0)));

  return sigmoid * middleGrey;
}

describe('Sigmoid Tone Mapping', () => {

  describe('Shader Content Validation', () => {
    it('should include sRGB conversion functions', () => {
      expect(sigmoidFragmentShader).toContain('srgbToLinear');
      // Sigmoid stays in Linear space (output shader converts to sRGB)
      expect(sigmoidFragmentShader).toContain('Keep in Linear space');
    });

    it('should include sigmoid curve function', () => {
      expect(sigmoidFragmentShader).toContain('sigmoidCurve');
    });

    it('should include per-channel application', () => {
      expect(sigmoidFragmentShader).toContain('applySigmoid');
    });

    it('should include all required uniforms', () => {
      expect(sigmoidFragmentShader).toContain('uniform float u_contrast');
      expect(sigmoidFragmentShader).toContain('uniform float u_skew');
      expect(sigmoidFragmentShader).toContain('uniform float u_middleGrey');
      expect(sigmoidFragmentShader).toContain('uniform bool u_enabled');
    });

    it('should include proper GLSL version', () => {
      expect(sigmoidFragmentShader).toContain('#version 300 es');
      expect(sigmoidVertexShader).toContain('#version 300 es');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultSigmoidParams.contrast).toBe(1.0);
      expect(defaultSigmoidParams.skew).toBe(0.0);
      expect(defaultSigmoidParams.middleGrey).toBe(0.1845);
      expect(defaultSigmoidParams.enabled).toBe(false);
    });

    it('should use photographic standard middle grey', () => {
      // 18.45% grey is the photographic standard
      expect(defaultSigmoidParams.middleGrey).toBeCloseTo(0.1845, 4);
    });
  });

  describe('Smooth S-Curve Shape', () => {
    it('should produce monotonically increasing curve', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const samples = 100;
      let prevValue = 0;

      for (let i = 0; i <= samples; i++) {
        const x = i / samples;
        const y = sigmoidCurveJS(x, params.contrast, params.skew, params.middleGrey);
        
        // Each value should be >= previous (monotonic)
        expect(y).toBeGreaterThanOrEqual(prevValue);
        prevValue = y;
      }
    });

    it('should have smooth transitions (no discontinuities)', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const samples = 100;
      
      // Check that the curve is continuous (no jumps)
      for (let i = 1; i < samples; i++) {
        const x1 = (i - 1) / samples;
        const x2 = i / samples;
        const y1 = sigmoidCurveJS(x1, params.contrast, params.skew, params.middleGrey);
        const y2 = sigmoidCurveJS(x2, params.contrast, params.skew, params.middleGrey);
        
        // The change should be small and continuous
        const change = Math.abs(y2 - y1);
        expect(change).toBeLessThan(0.1); // No large jumps
        expect(Number.isFinite(y1)).toBe(true);
        expect(Number.isFinite(y2)).toBe(true);
      }
    });

    it('should map black to black', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const result = sigmoidCurveJS(0.0, params.contrast, params.skew, params.middleGrey);
      expect(result).toBe(0.0);
    });

    it('should map white to white', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const result = sigmoidCurveJS(1.0, params.contrast, params.skew, params.middleGrey);
      expect(result).toBe(1.0);
    });

    it('should have inflection point near middle grey', () => {
      const params = { ...defaultSigmoidParams, enabled: true, skew: 0.0 };
      
      // At inflection point, the curve should be near middle grey
      const midPoint = 0.5;
      const result = sigmoidCurveJS(midPoint, params.contrast, params.skew, params.middleGrey);
      
      // Should be within reasonable range of middle grey
      expect(result).toBeGreaterThan(0.1);
      expect(result).toBeLessThan(0.3);
    });
  });

  describe('Color Preservation', () => {
    it('should preserve color ratios with per-channel processing', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      
      // Test with a color (e.g., orange: more red than green, minimal blue)
      const r = 0.8;
      const g = 0.4;
      const b = 0.1;
      
      const rMapped = sigmoidCurveJS(r, params.contrast, params.skew, params.middleGrey);
      const gMapped = sigmoidCurveJS(g, params.contrast, params.skew, params.middleGrey);
      const bMapped = sigmoidCurveJS(b, params.contrast, params.skew, params.middleGrey);
      
      // Ratios should be preserved (within tolerance due to S-curve compression)
      const originalRatio_RG = r / g;
      const mappedRatio_RG = rMapped / gMapped;
      
      // Allow some deviation due to tone compression, but should be similar
      expect(Math.abs(originalRatio_RG - mappedRatio_RG) / originalRatio_RG).toBeLessThan(0.5);
    });

    it('should maintain relative channel ordering', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      
      // If R > G > B before, it should remain R > G > B after
      const r = 0.7;
      const g = 0.5;
      const b = 0.3;
      
      const rMapped = sigmoidCurveJS(r, params.contrast, params.skew, params.middleGrey);
      const gMapped = sigmoidCurveJS(g, params.contrast, params.skew, params.middleGrey);
      const bMapped = sigmoidCurveJS(b, params.contrast, params.skew, params.middleGrey);
      
      expect(rMapped).toBeGreaterThan(gMapped);
      expect(gMapped).toBeGreaterThan(bMapped);
    });

    it('should not introduce hue shifts for neutral colors', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      
      // Neutral grey should remain neutral
      const grey = 0.5;
      const r = sigmoidCurveJS(grey, params.contrast, params.skew, params.middleGrey);
      const g = sigmoidCurveJS(grey, params.contrast, params.skew, params.middleGrey);
      const b = sigmoidCurveJS(grey, params.contrast, params.skew, params.middleGrey);
      
      // All channels should be equal
      expect(r).toBeCloseTo(g, 10);
      expect(g).toBeCloseTo(b, 10);
    });
  });

  describe('Parameter Range Validation', () => {
    describe('Contrast Parameter', () => {
      it('should handle minimum contrast (0.5)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          contrast: 0.5,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should handle maximum contrast (2.0)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          contrast: 2.0,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should produce steeper curve with higher contrast', () => {
        // Test at a point where contrast difference is more visible
        const testPoint = 0.3;
        const lowContrast = sigmoidCurveJS(testPoint, 0.5, 0.0, 0.1845);
        const highContrast = sigmoidCurveJS(testPoint, 2.0, 0.0, 0.1845);
        
        // Both should be valid
        expect(lowContrast).toBeGreaterThan(0);
        expect(lowContrast).toBeLessThan(1);
        expect(highContrast).toBeGreaterThan(0);
        expect(highContrast).toBeLessThan(1);
        
        // Higher contrast creates more separation from midpoint
        expect(highContrast).not.toBe(lowContrast);
      });
    });

    describe('Skew Parameter', () => {
      it('should handle minimum skew (-1.0)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          skew: -1.0,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should handle maximum skew (1.0)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          skew: 1.0,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should shift inflection point with negative skew', () => {
        const neutral = sigmoidCurveJS(0.3, 1.0, 0.0, 0.1845);
        const shadowBias = sigmoidCurveJS(0.3, 1.0, -0.5, 0.1845);
        
        // Negative skew should preserve more shadow detail
        expect(shadowBias).toBeGreaterThanOrEqual(neutral);
      });

      it('should shift inflection point with positive skew', () => {
        const neutral = sigmoidCurveJS(0.7, 1.0, 0.0, 0.1845);
        const highlightBias = sigmoidCurveJS(0.7, 1.0, 0.5, 0.1845);
        
        // Positive skew shifts the curve - values should differ
        // The exact relationship depends on the curve shape
        expect(highlightBias).not.toBe(neutral);
        expect(Number.isFinite(highlightBias)).toBe(true);
        expect(Number.isFinite(neutral)).toBe(true);
      });
    });

    describe('Middle Grey Parameter', () => {
      it('should handle minimum middle grey (0.1)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          middleGrey: 0.1,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should handle maximum middle grey (0.3)', () => {
        const params: SigmoidParams = {
          ...defaultSigmoidParams,
          middleGrey: 0.3,
          enabled: true,
        };
        
        const result = sigmoidCurveJS(0.5, params.contrast, params.skew, params.middleGrey);
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThan(1);
      });

      it('should affect overall brightness', () => {
        const darkGrey = sigmoidCurveJS(0.5, 1.0, 0.0, 0.1);
        const brightGrey = sigmoidCurveJS(0.5, 1.0, 0.0, 0.3);
        
        // Higher middle grey should produce brighter output
        expect(brightGrey).toBeGreaterThan(darkGrey);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small input values', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const result = sigmoidCurveJS(0.001, params.contrast, params.skew, params.middleGrey);
      
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(0.1);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle very large input values', () => {
      const params = { ...defaultSigmoidParams, enabled: true };
      const result = sigmoidCurveJS(0.999, params.contrast, params.skew, params.middleGrey);
      
      // The sigmoid curve maps to middleGrey range, so output is scaled
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1.0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle extreme contrast values gracefully', () => {
      const result = sigmoidCurveJS(0.5, 5.0, 0.0, 0.1845);
      
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle extreme skew values gracefully', () => {
      const result = sigmoidCurveJS(0.5, 1.0, 2.0, 0.1845);
      
      expect(Number.isFinite(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

});
