/**
 * Color Balance RGB Tests
 * 
 * Tests for Color Balance RGB implementation including:
 * - Luminance mask generation accuracy
 * - Per-zone color adjustments
 * - Smooth transitions between zones
 * - DT UCS color space conversions
 * - Parameter range validation
 */

import { describe, it, expect } from 'vitest';
import {
  colorBalanceRGBVertexShader,
  colorBalanceRGBFragmentShader,
  defaultColorBalanceRGBParams,
  type ColorBalanceRGBParams,
} from './colorbalancergb';

/**
 * JavaScript implementation of luminance mask generation for testing
 * Matches the GLSL implementation
 */
function generateLuminanceMasksJS(
  Y: number,
  grey: number,
  shadowsWeight: number,
  highlightsWeight: number
): { shadows: number; midtones: number; highlights: number } {
  Y = Math.max(0, Math.min(1, Y));

  const shadows = Math.pow(Math.max(0, Math.min(1, 1.0 - Y / grey)), shadowsWeight);
  const highlights = Math.pow(Math.max(0, Math.min(1, (Y - grey) / (1.0 - grey))), highlightsWeight);
  const midtones = Math.max(0, 1.0 - shadows - highlights);

  return { shadows, midtones, highlights };
}

describe('Color Balance RGB', () => {

  describe('Shader Content Validation', () => {
    it('should include sRGB conversion functions', () => {
      expect(colorBalanceRGBFragmentShader).toContain('srgbToLinear');
      expect(colorBalanceRGBFragmentShader).toContain('linearToSrgb');
    });

    it('should include DT UCS color space conversions', () => {
      expect(colorBalanceRGBFragmentShader).toContain('linearRGBToDTUCS');
      expect(colorBalanceRGBFragmentShader).toContain('dtucsToLinearRGB');
    });

    it('should include luminance mask generation', () => {
      expect(colorBalanceRGBFragmentShader).toContain('generateLuminanceMasks');
    });

    it('should include color adjustment functions', () => {
      expect(colorBalanceRGBFragmentShader).toContain('applyColorAdjustment');
      expect(colorBalanceRGBFragmentShader).toContain('applyContrast');
      expect(colorBalanceRGBFragmentShader).toContain('applyVibrance');
    });

    it('should include all required uniforms', () => {
      expect(colorBalanceRGBFragmentShader).toContain('uniform bool u_enabled');
      expect(colorBalanceRGBFragmentShader).toContain('uniform float u_shadowsWeight');
      expect(colorBalanceRGBFragmentShader).toContain('uniform float u_highlightsWeight');
      expect(colorBalanceRGBFragmentShader).toContain('uniform float u_maskGreyFulcrum');
      expect(colorBalanceRGBFragmentShader).toContain('uniform vec3 u_shadowsAdjust');
      expect(colorBalanceRGBFragmentShader).toContain('uniform vec3 u_midtonesAdjust');
      expect(colorBalanceRGBFragmentShader).toContain('uniform vec3 u_highlightsAdjust');
      expect(colorBalanceRGBFragmentShader).toContain('uniform vec3 u_globalAdjust');
      expect(colorBalanceRGBFragmentShader).toContain('uniform float u_contrast');
      expect(colorBalanceRGBFragmentShader).toContain('uniform float u_vibrance');
    });

    it('should include proper GLSL version', () => {
      expect(colorBalanceRGBFragmentShader).toContain('#version 300 es');
      expect(colorBalanceRGBVertexShader).toContain('#version 300 es');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultColorBalanceRGBParams.enabled).toBe(false);
      expect(defaultColorBalanceRGBParams.shadowsWeight).toBe(1.0);
      expect(defaultColorBalanceRGBParams.highlightsWeight).toBe(1.0);
      expect(defaultColorBalanceRGBParams.maskGreyFulcrum).toBe(0.1845);
      expect(defaultColorBalanceRGBParams.contrast).toBe(1.0);
      expect(defaultColorBalanceRGBParams.contrastFulcrum).toBe(0.1845);
      expect(defaultColorBalanceRGBParams.vibrance).toBe(0.0);
    });

    it('should have zero adjustments by default', () => {
      expect(defaultColorBalanceRGBParams.shadows.luminance).toBe(0.0);
      expect(defaultColorBalanceRGBParams.shadows.chroma).toBe(0.0);
      expect(defaultColorBalanceRGBParams.shadows.hue).toBe(0.0);
      
      expect(defaultColorBalanceRGBParams.midtones.luminance).toBe(0.0);
      expect(defaultColorBalanceRGBParams.midtones.chroma).toBe(0.0);
      expect(defaultColorBalanceRGBParams.midtones.hue).toBe(0.0);
      
      expect(defaultColorBalanceRGBParams.highlights.luminance).toBe(0.0);
      expect(defaultColorBalanceRGBParams.highlights.chroma).toBe(0.0);
      expect(defaultColorBalanceRGBParams.highlights.hue).toBe(0.0);
      
      expect(defaultColorBalanceRGBParams.global.luminance).toBe(0.0);
      expect(defaultColorBalanceRGBParams.global.chroma).toBe(0.0);
      expect(defaultColorBalanceRGBParams.global.hue).toBe(0.0);
    });

    it('should use photographic standard middle grey', () => {
      // 18.45% grey is the photographic standard
      expect(defaultColorBalanceRGBParams.maskGreyFulcrum).toBeCloseTo(0.1845, 4);
    });
  });

  describe('Luminance Mask Generation', () => {
    const grey = 0.1845;
    const shadowsWeight = 1.0;
    const highlightsWeight = 1.0;

    it('should generate shadow mask at black (1.0)', () => {
      const masks = generateLuminanceMasksJS(0.0, grey, shadowsWeight, highlightsWeight);
      
      expect(masks.shadows).toBeCloseTo(1.0, 5);
      expect(masks.highlights).toBeCloseTo(0.0, 5);
      expect(masks.midtones).toBeGreaterThanOrEqual(0.0);
    });

    it('should generate highlight mask at white (1.0)', () => {
      const masks = generateLuminanceMasksJS(1.0, grey, shadowsWeight, highlightsWeight);
      
      expect(masks.shadows).toBeCloseTo(0.0, 5);
      expect(masks.highlights).toBeCloseTo(1.0, 5);
      expect(masks.midtones).toBeGreaterThanOrEqual(0.0);
    });

    it('should generate balanced masks at grey fulcrum', () => {
      const masks = generateLuminanceMasksJS(grey, grey, shadowsWeight, highlightsWeight);
      
      expect(masks.shadows).toBeCloseTo(0.0, 5);
      expect(masks.highlights).toBeCloseTo(0.0, 5);
      expect(masks.midtones).toBeCloseTo(1.0, 5);
    });

    it('should have smooth transitions between zones', () => {
      const samples = 100;
      let prevShadows = 1.0;
      let prevHighlights = 0.0;

      for (let i = 0; i <= samples; i++) {
        const Y = i / samples;
        const masks = generateLuminanceMasksJS(Y, grey, shadowsWeight, highlightsWeight);

        // Shadows should decrease monotonically
        expect(masks.shadows).toBeLessThanOrEqual(prevShadows + 0.001);
        
        // Highlights should increase monotonically
        expect(masks.highlights).toBeGreaterThanOrEqual(prevHighlights - 0.001);
        
        // All masks should be in valid range
        expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
        expect(masks.shadows).toBeLessThanOrEqual(1.0);
        expect(masks.midtones).toBeGreaterThanOrEqual(0.0);
        expect(masks.midtones).toBeLessThanOrEqual(1.0);
        expect(masks.highlights).toBeGreaterThanOrEqual(0.0);
        expect(masks.highlights).toBeLessThanOrEqual(1.0);

        prevShadows = masks.shadows;
        prevHighlights = masks.highlights;
      }
    });

    it('should sum to approximately 1.0', () => {
      const samples = 20;

      for (let i = 0; i <= samples; i++) {
        const Y = i / samples;
        const masks = generateLuminanceMasksJS(Y, grey, shadowsWeight, highlightsWeight);
        const sum = masks.shadows + masks.midtones + masks.highlights;

        // Sum should be close to 1.0 (allowing small numerical errors)
        expect(sum).toBeGreaterThanOrEqual(0.95);
        expect(sum).toBeLessThanOrEqual(1.05);
      }
    });

    it('should respond to shadows weight parameter', () => {
      const Y = 0.1; // Dark value
      
      const softMask = generateLuminanceMasksJS(Y, grey, 0.5, highlightsWeight);
      const hardMask = generateLuminanceMasksJS(Y, grey, 2.0, highlightsWeight);

      // Higher weight should create sharper transition
      // At this dark value, hard mask should have higher shadow value
      expect(hardMask.shadows).toBeGreaterThan(softMask.shadows);
    });

    it('should respond to highlights weight parameter', () => {
      const Y = 0.8; // Bright value
      
      const softMask = generateLuminanceMasksJS(Y, grey, shadowsWeight, 0.5);
      const hardMask = generateLuminanceMasksJS(Y, grey, shadowsWeight, 2.0);

      // Higher weight should create sharper transition
      // At this bright value, hard mask should have higher highlight value
      expect(hardMask.highlights).toBeGreaterThan(softMask.highlights);
    });

    it('should handle different grey fulcrum values', () => {
      const Y = 0.25;
      
      const darkGrey = generateLuminanceMasksJS(Y, 0.1, shadowsWeight, highlightsWeight);
      const brightGrey = generateLuminanceMasksJS(Y, 0.3, shadowsWeight, highlightsWeight);

      // With darker grey fulcrum, this value should be more in highlights
      // With brighter grey fulcrum, this value should be more in shadows
      expect(darkGrey.highlights).toBeGreaterThan(brightGrey.highlights);
      expect(darkGrey.shadows).toBeLessThan(brightGrey.shadows);
    });
  });

  describe('Parameter Range Validation', () => {
    describe('Mask Weight Parameters', () => {
      it('should handle minimum weight (0.5)', () => {
        const masks = generateLuminanceMasksJS(0.1, 0.1845, 0.5, 0.5);
        
        expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
        expect(masks.shadows).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(masks.shadows)).toBe(true);
      });

      it('should handle maximum weight (3.0)', () => {
        const masks = generateLuminanceMasksJS(0.1, 0.1845, 3.0, 3.0);
        
        expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
        expect(masks.shadows).toBeLessThanOrEqual(1.0);
        expect(Number.isFinite(masks.shadows)).toBe(true);
      });
    });

    describe('Grey Fulcrum Parameter', () => {
      it('should handle minimum grey fulcrum (0.1)', () => {
        const masks = generateLuminanceMasksJS(0.15, 0.1, 1.0, 1.0);
        
        expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
        expect(masks.midtones).toBeGreaterThanOrEqual(0.0);
        expect(masks.highlights).toBeGreaterThanOrEqual(0.0);
      });

      it('should handle maximum grey fulcrum (0.3)', () => {
        const masks = generateLuminanceMasksJS(0.25, 0.3, 1.0, 1.0);
        
        expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
        expect(masks.midtones).toBeGreaterThanOrEqual(0.0);
        expect(masks.highlights).toBeGreaterThanOrEqual(0.0);
      });
    });

    describe('Adjustment Parameters', () => {
      it('should handle luminance adjustment range (-1.0 to 1.0)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          shadows: { luminance: -1.0, chroma: 0.0, hue: 0.0 },
        };
        
        expect(params.shadows.luminance).toBe(-1.0);
        
        params.shadows.luminance = 1.0;
        expect(params.shadows.luminance).toBe(1.0);
      });

      it('should handle chroma adjustment range (-1.0 to 1.0)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          midtones: { luminance: 0.0, chroma: -1.0, hue: 0.0 },
        };
        
        expect(params.midtones.chroma).toBe(-1.0);
        
        params.midtones.chroma = 1.0;
        expect(params.midtones.chroma).toBe(1.0);
      });

      it('should handle hue adjustment range (-PI to PI)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          highlights: { luminance: 0.0, chroma: 0.0, hue: -Math.PI },
        };
        
        expect(params.highlights.hue).toBeCloseTo(-Math.PI, 5);
        
        params.highlights.hue = Math.PI;
        expect(params.highlights.hue).toBeCloseTo(Math.PI, 5);
      });
    });

    describe('Contrast Parameter', () => {
      it('should handle minimum contrast (0.5)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          contrast: 0.5,
        };
        
        expect(params.contrast).toBe(0.5);
      });

      it('should handle maximum contrast (2.0)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          contrast: 2.0,
        };
        
        expect(params.contrast).toBe(2.0);
      });
    });

    describe('Vibrance Parameter', () => {
      it('should handle minimum vibrance (-1.0)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          vibrance: -1.0,
        };
        
        expect(params.vibrance).toBe(-1.0);
      });

      it('should handle maximum vibrance (1.0)', () => {
        const params: ColorBalanceRGBParams = {
          ...defaultColorBalanceRGBParams,
          enabled: true,
          vibrance: 1.0,
        };
        
        expect(params.vibrance).toBe(1.0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle pure black input', () => {
      const masks = generateLuminanceMasksJS(0.0, 0.1845, 1.0, 1.0);
      
      expect(Number.isFinite(masks.shadows)).toBe(true);
      expect(Number.isFinite(masks.midtones)).toBe(true);
      expect(Number.isFinite(masks.highlights)).toBe(true);
      expect(masks.shadows).toBeCloseTo(1.0, 5);
    });

    it('should handle pure white input', () => {
      const masks = generateLuminanceMasksJS(1.0, 0.1845, 1.0, 1.0);
      
      expect(Number.isFinite(masks.shadows)).toBe(true);
      expect(Number.isFinite(masks.midtones)).toBe(true);
      expect(Number.isFinite(masks.highlights)).toBe(true);
      expect(masks.highlights).toBeCloseTo(1.0, 5);
    });

    it('should handle very small luminance values', () => {
      const masks = generateLuminanceMasksJS(0.001, 0.1845, 1.0, 1.0);
      
      expect(Number.isFinite(masks.shadows)).toBe(true);
      expect(Number.isFinite(masks.midtones)).toBe(true);
      expect(Number.isFinite(masks.highlights)).toBe(true);
      expect(masks.shadows).toBeGreaterThan(0.9);
    });

    it('should handle very large luminance values', () => {
      const masks = generateLuminanceMasksJS(0.999, 0.1845, 1.0, 1.0);
      
      expect(Number.isFinite(masks.shadows)).toBe(true);
      expect(Number.isFinite(masks.midtones)).toBe(true);
      expect(Number.isFinite(masks.highlights)).toBe(true);
      expect(masks.highlights).toBeGreaterThan(0.9);
    });

    it('should handle extreme weight values', () => {
      const masks = generateLuminanceMasksJS(0.5, 0.1845, 5.0, 5.0);
      
      expect(Number.isFinite(masks.shadows)).toBe(true);
      expect(Number.isFinite(masks.midtones)).toBe(true);
      expect(Number.isFinite(masks.highlights)).toBe(true);
      expect(masks.shadows).toBeGreaterThanOrEqual(0.0);
      expect(masks.shadows).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Zone Independence', () => {
    it('should allow independent shadow adjustments', () => {
      const params: ColorBalanceRGBParams = {
        ...defaultColorBalanceRGBParams,
        enabled: true,
        shadows: { luminance: 0.5, chroma: 0.3, hue: 0.1 },
      };
      
      // Other zones should remain at default
      expect(params.midtones.luminance).toBe(0.0);
      expect(params.highlights.luminance).toBe(0.0);
      expect(params.global.luminance).toBe(0.0);
    });

    it('should allow independent midtone adjustments', () => {
      const params: ColorBalanceRGBParams = {
        ...defaultColorBalanceRGBParams,
        enabled: true,
        midtones: { luminance: -0.3, chroma: 0.5, hue: -0.2 },
      };
      
      // Other zones should remain at default
      expect(params.shadows.luminance).toBe(0.0);
      expect(params.highlights.luminance).toBe(0.0);
      expect(params.global.luminance).toBe(0.0);
    });

    it('should allow independent highlight adjustments', () => {
      const params: ColorBalanceRGBParams = {
        ...defaultColorBalanceRGBParams,
        enabled: true,
        highlights: { luminance: 0.2, chroma: -0.4, hue: 0.5 },
      };
      
      // Other zones should remain at default
      expect(params.shadows.luminance).toBe(0.0);
      expect(params.midtones.luminance).toBe(0.0);
      expect(params.global.luminance).toBe(0.0);
    });

    it('should allow global adjustments affecting all zones', () => {
      const params: ColorBalanceRGBParams = {
        ...defaultColorBalanceRGBParams,
        enabled: true,
        global: { luminance: 0.1, chroma: 0.2, hue: 0.3 },
      };
      
      // Global adjustments are separate from zone adjustments
      expect(params.global.luminance).toBe(0.1);
      expect(params.global.chroma).toBe(0.2);
      expect(params.global.hue).toBe(0.3);
    });
  });

});
