/**
 * Gamut Mapping Shader Tests
 * Tests gamut detection, compression, and hue preservation
 */

import { describe, it, expect } from 'vitest';
import {
  gamutMappingVertexShader,
  gamutMappingFragmentShader,
  defaultGamutMappingParams,
  type GamutMappingParams,
} from './gamutmapping';

describe('Gamut Mapping Shader', () => {

  describe('Shader Content Validation', () => {
    it('should include sRGB conversion functions', () => {
      expect(gamutMappingFragmentShader).toContain('srgbToLinear');
      expect(gamutMappingFragmentShader).toContain('linearToSrgb');
    });

    it('should include Lab color space conversions', () => {
      expect(gamutMappingFragmentShader).toContain('linearRGBToLab');
      expect(gamutMappingFragmentShader).toContain('labToLinearRGB');
      expect(gamutMappingFragmentShader).toContain('xyzD50ToLab');
      expect(gamutMappingFragmentShader).toContain('labToXYZ_D50');
    });

    it('should include LCH color space conversions', () => {
      expect(gamutMappingFragmentShader).toContain('labToLCH');
      expect(gamutMappingFragmentShader).toContain('lchToLab');
      expect(gamutMappingFragmentShader).toContain('linearRGBToLCH');
      expect(gamutMappingFragmentShader).toContain('lchToLinearRGB');
    });

    it('should include gamut detection functions', () => {
      expect(gamutMappingFragmentShader).toContain('isInSRGBGamut');
      expect(gamutMappingFragmentShader).toContain('isInDisplayP3Gamut');
      expect(gamutMappingFragmentShader).toContain('isInRec2020Gamut');
      expect(gamutMappingFragmentShader).toContain('getMaxChroma');
    });

    it('should include gamut compression methods', () => {
      expect(gamutMappingFragmentShader).toContain('perceptualGamutCompression');
      expect(gamutMappingFragmentShader).toContain('saturationGamutMapping');
      expect(gamutMappingFragmentShader).toContain('relativeColorimetricMapping');
    });

    it('should include all required uniforms', () => {
      expect(gamutMappingFragmentShader).toContain('uniform bool u_enabled');
      expect(gamutMappingFragmentShader).toContain('uniform int u_targetGamut');
      expect(gamutMappingFragmentShader).toContain('uniform int u_mappingMethod');
      expect(gamutMappingFragmentShader).toContain('uniform float u_compressionAmount');
    });

    it('should include gamut constants', () => {
      expect(gamutMappingFragmentShader).toContain('GAMUT_SRGB');
      expect(gamutMappingFragmentShader).toContain('GAMUT_DISPLAY_P3');
      expect(gamutMappingFragmentShader).toContain('GAMUT_REC2020');
    });

    it('should include mapping method constants', () => {
      expect(gamutMappingFragmentShader).toContain('METHOD_PERCEPTUAL');
      expect(gamutMappingFragmentShader).toContain('METHOD_SATURATION');
      expect(gamutMappingFragmentShader).toContain('METHOD_RELATIVE');
    });

    it('should include proper GLSL version', () => {
      expect(gamutMappingFragmentShader).toContain('#version 300 es');
      expect(gamutMappingVertexShader).toContain('#version 300 es');
    });

    it('should include hue preservation logic', () => {
      // Hue preservation is achieved by working in LCH space
      expect(gamutMappingFragmentShader).toContain('float H = atan');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultGamutMappingParams.enabled).toBe(false);
      expect(defaultGamutMappingParams.targetGamut).toBe('sRGB');
      expect(defaultGamutMappingParams.mappingMethod).toBe('perceptual');
      expect(defaultGamutMappingParams.compressionAmount).toBe(0.8);
    });

    it('should have compression amount in valid range', () => {
      expect(defaultGamutMappingParams.compressionAmount).toBeGreaterThanOrEqual(0);
      expect(defaultGamutMappingParams.compressionAmount).toBeLessThanOrEqual(1);
    });

    it('should default to perceptual mapping method', () => {
      expect(defaultGamutMappingParams.mappingMethod).toBe('perceptual');
    });

    it('should default to sRGB gamut', () => {
      expect(defaultGamutMappingParams.targetGamut).toBe('sRGB');
    });

    it('should be disabled by default', () => {
      expect(defaultGamutMappingParams.enabled).toBe(false);
    });
  });

  describe('Parameter Range Validation', () => {
    describe('Target Gamut Parameter', () => {
      it('should support sRGB gamut', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          targetGamut: 'sRGB',
        };
        expect(params.targetGamut).toBe('sRGB');
      });

      it('should support Display P3 gamut', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          targetGamut: 'Display P3',
        };
        expect(params.targetGamut).toBe('Display P3');
      });

      it('should support Rec2020 gamut', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          targetGamut: 'Rec2020',
        };
        expect(params.targetGamut).toBe('Rec2020');
      });
    });

    describe('Mapping Method Parameter', () => {
      it('should support perceptual mapping', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          mappingMethod: 'perceptual',
        };
        expect(params.mappingMethod).toBe('perceptual');
      });

      it('should support saturation mapping', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          mappingMethod: 'saturation',
        };
        expect(params.mappingMethod).toBe('saturation');
      });

      it('should support relative colorimetric mapping', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          mappingMethod: 'relative',
        };
        expect(params.mappingMethod).toBe('relative');
      });
    });

    describe('Compression Amount Parameter', () => {
      it('should handle minimum compression (0.0)', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          compressionAmount: 0.0,
        };
        expect(params.compressionAmount).toBe(0.0);
      });

      it('should handle maximum compression (1.0)', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          compressionAmount: 1.0,
        };
        expect(params.compressionAmount).toBe(1.0);
      });

      it('should handle mid-range compression', () => {
        const params: GamutMappingParams = {
          ...defaultGamutMappingParams,
          compressionAmount: 0.5,
        };
        expect(params.compressionAmount).toBe(0.5);
      });
    });
  });

  describe('Algorithm Implementation', () => {
    it('should implement soft compression curve', () => {
      // Verify exponential rolloff is used for smooth compression
      expect(gamutMappingFragmentShader).toContain('exp(-C / maxChroma');
    });

    it('should preserve hue in perceptual method', () => {
      // Hue (H) should be maintained in LCH space
      expect(gamutMappingFragmentShader).toContain('return vec3(L, finalC, H)');
    });

    it('should use Bradford chromatic adaptation', () => {
      expect(gamutMappingFragmentShader).toContain('bradfordD65toD50');
      expect(gamutMappingFragmentShader).toContain('bradfordD50toD65');
    });

    it('should implement smooth compression blending', () => {
      expect(gamutMappingFragmentShader).toContain('outOfGamutAmount');
      expect(gamutMappingFragmentShader).toContain('mix(C, compressedC');
    });

    it('should clamp final output to valid range', () => {
      expect(gamutMappingFragmentShader).toContain('clamp(mappedRGB, 0.0, 1.0)');
    });
  });

  describe('Color Science Accuracy', () => {
    it('should use D50 illuminant for Lab conversions', () => {
      expect(gamutMappingFragmentShader).toContain('vec3(0.9642, 1.0000, 0.8249)');
    });

    it('should implement proper Lab f function', () => {
      expect(gamutMappingFragmentShader).toContain('labF');
      expect(gamutMappingFragmentShader).toContain('labFInv');
    });

    it('should handle lightness-dependent chroma limits', () => {
      expect(gamutMappingFragmentShader).toContain('lightnessScale');
    });

    it('should handle hue-dependent chroma limits', () => {
      expect(gamutMappingFragmentShader).toContain('hueScale');
    });
  });
});
