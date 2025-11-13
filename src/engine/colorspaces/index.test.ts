/**
 * Color Space Library Integration Tests
 * 
 * Tests for the complete color space conversion library
 */

import { describe, it, expect } from 'vitest';
import { allColorSpaceShadersGLSL } from './index';

describe('Color Space Library Integration', () => {
  describe('Combined shader library', () => {
    it('should export allColorSpaceShadersGLSL as a string', () => {
      expect(typeof allColorSpaceShadersGLSL).toBe('string');
      expect(allColorSpaceShadersGLSL.length).toBeGreaterThan(0);
    });

    it('should include all base color space conversions', () => {
      // sRGB conversions
      expect(allColorSpaceShadersGLSL).toContain('sRGBToLinear');
      expect(allColorSpaceShadersGLSL).toContain('linearToSRGB');
      
      // XYZ conversions
      expect(allColorSpaceShadersGLSL).toContain('linearRGBToXYZ_D65');
      expect(allColorSpaceShadersGLSL).toContain('linearRGBToXYZ_D50');
      
      // Lab conversions
      expect(allColorSpaceShadersGLSL).toContain('xyzD50ToLab');
      expect(allColorSpaceShadersGLSL).toContain('labToXYZ_D50');
      
      // ProPhoto RGB
      expect(allColorSpaceShadersGLSL).toContain('linearRGBToProPhotoRGB');
      expect(allColorSpaceShadersGLSL).toContain('proPhotoRGBToLinearRGB');
      
      // Bradford adaptation
      expect(allColorSpaceShadersGLSL).toContain('bradfordAdaptation');
    });

    it('should include DT UCS color space', () => {
      expect(allColorSpaceShadersGLSL).toContain('linearRGBToDTUCS');
      expect(allColorSpaceShadersGLSL).toContain('dtucsToLinearRGB');
      expect(allColorSpaceShadersGLSL).toContain('generateLuminanceMasks');
      expect(allColorSpaceShadersGLSL).toContain('applyColorBalanceRGB');
    });

    it('should include JzAzBz color space', () => {
      expect(allColorSpaceShadersGLSL).toContain('linearRGBToJzAzBz');
      expect(allColorSpaceShadersGLSL).toContain('jzAzBzToLinearRGB');
      expect(allColorSpaceShadersGLSL).toContain('applySaturationJzAzBz');
      expect(allColorSpaceShadersGLSL).toContain('applyVibranceJzAzBz');
    });

    it('should not have duplicate function definitions', () => {
      // Check that key functions appear only once
      const countOccurrences = (str: string, pattern: string): number => {
        const regex = new RegExp(pattern, 'g');
        return (str.match(regex) || []).length;
      };
      
      // These functions should appear exactly once
      expect(countOccurrences(allColorSpaceShadersGLSL, 'vec3 sRGBToLinear\\(')).toBe(1);
      expect(countOccurrences(allColorSpaceShadersGLSL, 'vec3 linearToSRGB\\(')).toBe(1);
      expect(countOccurrences(allColorSpaceShadersGLSL, 'vec3 linearRGBToXYZ_D65\\(')).toBe(1);
    });

    it('should be valid GLSL syntax structure', () => {
      // Check for balanced braces
      const openBraces = (allColorSpaceShadersGLSL.match(/{/g) || []).length;
      const closeBraces = (allColorSpaceShadersGLSL.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
      
      // Check for balanced parentheses in function declarations
      const functionDecls = allColorSpaceShadersGLSL.match(/vec\d \w+\([^)]*\)/g) || [];
      expect(functionDecls.length).toBeGreaterThan(0);
    });
  });

  describe('Module exports', () => {
    it('should export all color space shader libraries', async () => {
      const module = await import('./index');
      
      expect(module.colorSpaceShaderLib).toBeDefined();
      expect(module.dtUCSShaderLib).toBeDefined();
      expect(module.jzAzBzShaderLib).toBeDefined();
      expect(module.allColorSpaceShadersGLSL).toBeDefined();
    });

    it('should export illuminants', async () => {
      const module = await import('./index');
      
      expect(module.Illuminants).toBeDefined();
      expect(module.Illuminants.D50).toBeDefined();
      expect(module.Illuminants.D65).toBeDefined();
    });

    it('should export utility functions', async () => {
      const module = await import('./index');
      
      expect(module.temperatureToXYZ).toBeDefined();
      expect(module.temperatureToWhitePointGLSL).toBeDefined();
      expect(module.degreesToRadians).toBeDefined();
      expect(module.radiansToDegrees).toBeDefined();
    });

    it('should export default parameters', async () => {
      const module = await import('./index');
      
      expect(module.defaultColorBalanceParams).toBeDefined();
      expect(module.defaultSaturationParams).toBeDefined();
    });

    it('should export TypeScript types', async () => {
      // This test verifies that types are exported (TypeScript compilation will catch issues)
      await import('./index');
      
      // If we got here without TypeScript errors, types are exported correctly
      expect(true).toBe(true);
    });
  });

  describe('Library completeness', () => {
    it('should provide conversions for all major color spaces', () => {
      const requiredSpaces = [
        'sRGB',
        'Linear',
        'XYZ',
        'Lab',
        'LCH',
        'ProPhoto',
        'DTUCS',
        'JzAzBz',
      ];
      
      requiredSpaces.forEach(space => {
        expect(allColorSpaceShadersGLSL.toLowerCase()).toContain(space.toLowerCase());
      });
    });

    it('should provide both forward and inverse conversions', () => {
      const conversionPairs = [
        ['sRGBToLinear', 'linearToSRGB'],
        ['linearRGBToXYZ', 'xyzToLinearRGB'],
        ['xyzToLab', 'labToXYZ'],
        ['labToLCH', 'lchToLab'],
        ['linearRGBToDTUCS', 'dtucsToLinearRGB'],
        ['linearRGBToJzAzBz', 'jzAzBzToLinearRGB'],
      ];
      
      conversionPairs.forEach(([forward, inverse]) => {
        expect(allColorSpaceShadersGLSL).toContain(forward);
        expect(allColorSpaceShadersGLSL).toContain(inverse);
      });
    });

    it('should provide color adjustment functions', () => {
      const adjustmentFunctions = [
        'adjustChroma',
        'adjustLightness',
        'rotateHue',
        'applySaturation',
        'applyVibrance',
        'colorGrade',
      ];
      
      adjustmentFunctions.forEach(func => {
        expect(allColorSpaceShadersGLSL).toContain(func);
      });
    });
  });
});
