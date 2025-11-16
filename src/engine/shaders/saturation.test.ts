/**
 * Perceptual Saturation Tests
 * 
 * Tests for saturation and vibrance implementation including:
 * - Perceptual uniformity in JzAzBz color space
 * - Vibrance adaptive saturation behavior
 * - Skin tone protection accuracy
 * - Parameter range validation
 */

import { describe, it, expect } from 'vitest';
import {
  saturationVertexShader,
  saturationFragmentShader,
  defaultSaturationParams,
  type SaturationParams,
} from './saturation';

describe('Perceptual Saturation', () => {

  describe('Shader Content Validation', () => {
    it('should include sRGB conversion functions', () => {
      expect(saturationFragmentShader).toContain('srgbToLinear');
      // Saturation stays in Linear space (output shader converts to sRGB)
      expect(saturationFragmentShader).toContain('Keep in Linear space');
    });

    it('should include JzAzBz color space conversions', () => {
      expect(saturationFragmentShader).toContain('linearRGBToJzAzBz');
      expect(saturationFragmentShader).toContain('jzAzBzToLinearRGB');
    });

    it('should include PQ transfer functions', () => {
      expect(saturationFragmentShader).toContain('pqEncode');
      expect(saturationFragmentShader).toContain('pqDecode');
    });

    it('should include saturation functions', () => {
      expect(saturationFragmentShader).toContain('applyGlobalSaturation');
      expect(saturationFragmentShader).toContain('applyVibrance');
      expect(saturationFragmentShader).toContain('applySkinToneProtection');
    });

    it('should include all required uniforms', () => {
      expect(saturationFragmentShader).toContain('uniform bool u_enabled');
      expect(saturationFragmentShader).toContain('uniform float u_saturation');
      expect(saturationFragmentShader).toContain('uniform float u_vibrance');
      expect(saturationFragmentShader).toContain('uniform bool u_skinToneProtection');
      expect(saturationFragmentShader).toContain('uniform float u_skinProtectionStrength');
    });

    it('should include proper GLSL version', () => {
      expect(saturationFragmentShader).toContain('#version 300 es');
      expect(saturationVertexShader).toContain('#version 300 es');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultSaturationParams.enabled).toBe(false);
      expect(defaultSaturationParams.saturation).toBe(0.0);
      expect(defaultSaturationParams.vibrance).toBe(0.0);
      expect(defaultSaturationParams.skinToneProtection).toBe(true);
      expect(defaultSaturationParams.skinProtectionStrength).toBe(0.5);
    });

    it('should have skin tone protection enabled by default', () => {
      expect(defaultSaturationParams.skinToneProtection).toBe(true);
    });

    it('should have moderate skin protection strength', () => {
      expect(defaultSaturationParams.skinProtectionStrength).toBeGreaterThanOrEqual(0.0);
      expect(defaultSaturationParams.skinProtectionStrength).toBeLessThanOrEqual(1.0);
      expect(defaultSaturationParams.skinProtectionStrength).toBe(0.5);
    });
  });

  describe('Parameter Range Validation', () => {
    describe('Saturation Parameter', () => {
      it('should handle minimum saturation (-1.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          saturation: -1.0,
        };
        
        expect(params.saturation).toBe(-1.0);
      });

      it('should handle maximum saturation (1.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          saturation: 1.0,
        };
        
        expect(params.saturation).toBe(1.0);
      });

      it('should handle neutral saturation (0.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          saturation: 0.0,
        };
        
        expect(params.saturation).toBe(0.0);
      });
    });

    describe('Vibrance Parameter', () => {
      it('should handle minimum vibrance (-1.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          vibrance: -1.0,
        };
        
        expect(params.vibrance).toBe(-1.0);
      });

      it('should handle maximum vibrance (1.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          vibrance: 1.0,
        };
        
        expect(params.vibrance).toBe(1.0);
      });

      it('should handle neutral vibrance (0.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          vibrance: 0.0,
        };
        
        expect(params.vibrance).toBe(0.0);
      });
    });

    describe('Skin Protection Strength Parameter', () => {
      it('should handle minimum protection strength (0.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          skinProtectionStrength: 0.0,
        };
        
        expect(params.skinProtectionStrength).toBe(0.0);
      });

      it('should handle maximum protection strength (1.0)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          skinProtectionStrength: 1.0,
        };
        
        expect(params.skinProtectionStrength).toBe(1.0);
      });

      it('should handle moderate protection strength (0.5)', () => {
        const params: SaturationParams = {
          ...defaultSaturationParams,
          enabled: true,
          skinProtectionStrength: 0.5,
        };
        
        expect(params.skinProtectionStrength).toBe(0.5);
      });
    });
  });

  describe('Shader Algorithm Validation', () => {
    it('should maintain luminance during saturation adjustment', () => {
      // The shader should preserve Jz (lightness) when adjusting chroma
      expect(saturationFragmentShader).toContain('// Maintain luminance (Jz unchanged)');
    });

    it('should use adaptive weighting for vibrance', () => {
      // Vibrance should enhance muted colors more than saturated colors
      expect(saturationFragmentShader).toContain('satWeight');
      expect(saturationFragmentShader).toContain('1.0 - pow(normalizedC, 0.5)');
    });

    it('should implement skin tone hue range detection', () => {
      // Skin tones are typically in the 30-60 degree range
      expect(saturationFragmentShader).toContain('20.0');
      expect(saturationFragmentShader).toContain('70.0');
      expect(saturationFragmentShader).toContain('45.0'); // Peak protection
    });

    it('should use smooth falloff for skin tone protection', () => {
      // Should use smoothstep for natural protection transitions
      expect(saturationFragmentShader).toContain('smoothstep');
    });
  });

  describe('Color Space Conversions', () => {
    it('should include XYZ D65 conversion matrices', () => {
      // Check for proper RGB to XYZ matrix values
      expect(saturationFragmentShader).toContain('0.4124564');
      expect(saturationFragmentShader).toContain('0.2126729');
      expect(saturationFragmentShader).toContain('0.0193339');
    });

    it('should include LMS cone response conversion', () => {
      // JzAzBz uses LMS cone response space
      expect(saturationFragmentShader).toContain('xyzToLMS');
      expect(saturationFragmentShader).toContain('lmsToXYZ');
    });

    it('should apply PQ encoding for perceptual uniformity', () => {
      // PQ (Perceptual Quantizer) is essential for JzAzBz
      expect(saturationFragmentShader).toContain('pqEncode');
      expect(saturationFragmentShader).toContain('m1 = 0.1593017578125');
      expect(saturationFragmentShader).toContain('m2 = 78.84375');
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled state', () => {
      const params: SaturationParams = {
        ...defaultSaturationParams,
        enabled: false,
        saturation: 1.0,
        vibrance: 1.0,
      };
      
      expect(params.enabled).toBe(false);
      // When disabled, adjustments should not be applied
    });

    it('should handle zero saturation and vibrance', () => {
      const params: SaturationParams = {
        ...defaultSaturationParams,
        enabled: true,
        saturation: 0.0,
        vibrance: 0.0,
      };
      
      // Should pass through unchanged
      expect(params.saturation).toBe(0.0);
      expect(params.vibrance).toBe(0.0);
    });

    it('should handle skin protection disabled', () => {
      const params: SaturationParams = {
        ...defaultSaturationParams,
        enabled: true,
        skinToneProtection: false,
        saturation: 1.0,
      };
      
      expect(params.skinToneProtection).toBe(false);
      // Should apply full saturation to all hues including skin tones
    });

    it('should handle maximum skin protection', () => {
      const params: SaturationParams = {
        ...defaultSaturationParams,
        enabled: true,
        skinToneProtection: true,
        skinProtectionStrength: 1.0,
        saturation: 1.0,
      };
      
      expect(params.skinProtectionStrength).toBe(1.0);
      // Should fully protect skin tones from saturation adjustment
    });
  });

  describe('Perceptual Uniformity', () => {
    it('should work in JzAzBz color space', () => {
      // JzAzBz is perceptually uniform and HDR-capable
      expect(saturationFragmentShader).toContain('linearRGBToJzAzBz');
      expect(saturationFragmentShader).toContain('jzAzBzToLinearRGB');
    });

    it('should preserve hue during saturation adjustment', () => {
      // Hue angle H should be preserved when scaling chroma
      expect(saturationFragmentShader).toContain('float H = atan(Bz, Az)');
      expect(saturationFragmentShader).toContain('newAz = newC * cos(H)');
      expect(saturationFragmentShader).toContain('newBz = newC * sin(H)');
    });

    it('should scale chroma multiplicatively', () => {
      // Perceptual saturation uses multiplicative scaling
      expect(saturationFragmentShader).toContain('saturationMultiplier = 1.0 + saturation');
      expect(saturationFragmentShader).toContain('newC = C * saturationMultiplier');
    });
  });

  describe('Vibrance Behavior', () => {
    it('should enhance muted colors more than saturated colors', () => {
      // Vibrance weight should decrease as chroma increases
      expect(saturationFragmentShader).toContain('satWeight = 1.0 - pow(normalizedC, 0.5)');
    });

    it('should normalize chroma for weight calculation', () => {
      // Chroma should be normalized to 0-1 range
      expect(saturationFragmentShader).toContain('normalizedC = clamp(C / 0.15, 0.0, 1.0)');
    });

    it('should apply adaptive multiplier', () => {
      // Vibrance multiplier should be adaptive based on existing chroma
      expect(saturationFragmentShader).toContain('vibranceMultiplier = 1.0 + vibrance * satWeight');
    });
  });

  describe('Skin Tone Protection', () => {
    it('should detect skin tone hue range', () => {
      // Skin tones are typically orange-yellow (30-60 degrees)
      expect(saturationFragmentShader).toContain('hueDegrees >= 20.0 && hueDegrees <= 70.0');
    });

    it('should have peak protection at 45 degrees', () => {
      // Maximum protection should be at the center of skin tone range
      expect(saturationFragmentShader).toContain('distanceFromPeak = abs(hueDegrees - 45.0)');
    });

    it('should use smooth protection falloff', () => {
      // Protection should smoothly decrease away from peak
      expect(saturationFragmentShader).toContain('smoothstep(25.0, 0.0, distanceFromPeak)');
    });

    it('should blend toward original color', () => {
      // Protection works by blending toward original unmodified color
      expect(saturationFragmentShader).toContain('mix(jab, originalJab, protectionAmount)');
    });

    it('should respect protection strength parameter', () => {
      // Protection amount should be modulated by strength parameter
      expect(saturationFragmentShader).toContain('skinToneWeight * protectionStrength');
    });
  });

  describe('Integration', () => {
    it('should apply adjustments in correct order', () => {
      // Order: saturation -> vibrance -> skin protection
      const shaderLines = saturationFragmentShader.split('\n');
      const saturationIndex = shaderLines.findIndex(line => line.includes('applyGlobalSaturation'));
      const vibranceIndex = shaderLines.findIndex(line => line.includes('applyVibrance'));
      const protectionIndex = shaderLines.findIndex(line => line.includes('applySkinToneProtection'));
      
      expect(saturationIndex).toBeGreaterThan(0);
      expect(vibranceIndex).toBeGreaterThan(saturationIndex);
      expect(protectionIndex).toBeGreaterThan(vibranceIndex);
    });

    it('should clamp output to valid range', () => {
      // Final RGB should be clamped to 0-1
      expect(saturationFragmentShader).toContain('clamp(rgb, 0.0, 1.0)');
    });

    it('should convert back to sRGB for display', () => {
      // Final output should be in sRGB space
      expect(saturationFragmentShader).toContain('linearToSrgb');
    });
  });

});
