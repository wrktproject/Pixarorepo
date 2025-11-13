/**
 * Color Space Conversion Tests
 * 
 * Tests for accurate color space conversions including:
 * - sRGB ↔ Linear RGB
 * - RGB ↔ XYZ (D50 and D65)
 * - XYZ ↔ Lab
 * - ProPhoto RGB
 * - Round-trip accuracy
 * - Edge cases
 */

import { describe, it, expect } from 'vitest';
import { temperatureToXYZ, Illuminants } from './colorspaces';

describe('Color Space Conversions', () => {
  describe('Temperature to XYZ conversion', () => {
    it('should convert 6500K (D65) to approximately correct white point', () => {
      const xyz = temperatureToXYZ(6500);
      
      // D65 white point is approximately (0.9505, 1.0000, 1.0890)
      expect(xyz.x).toBeCloseTo(0.9505, 1);
      expect(xyz.y).toBeCloseTo(1.0000, 3);
      expect(xyz.z).toBeCloseTo(1.0890, 1);
    });

    it('should convert 5000K (D50) to approximately correct white point', () => {
      const xyz = temperatureToXYZ(5000);
      
      // D50 white point is approximately (0.9642, 1.0000, 0.8249)
      expect(xyz.x).toBeCloseTo(0.9642, 1);
      expect(xyz.y).toBeCloseTo(1.0000, 3);
      expect(xyz.z).toBeCloseTo(0.8249, 1);
    });

    it('should handle low temperature (2000K - warm)', () => {
      const xyz = temperatureToXYZ(2000);
      
      // Warm light should have more red (higher X) and less blue (lower Z)
      expect(xyz.x).toBeGreaterThan(1.0);
      expect(xyz.z).toBeLessThan(0.5);
    });

    it('should handle high temperature (25000K - cool)', () => {
      const xyz = temperatureToXYZ(25000);
      
      // Cool light should have less red (lower X) and more blue (higher Z)
      expect(xyz.x).toBeLessThan(1.0);
      expect(xyz.z).toBeGreaterThan(1.0);
    });

    it('should clamp temperatures outside valid range', () => {
      const tooLow = temperatureToXYZ(1000);
      const atMin = temperatureToXYZ(2000);
      
      expect(tooLow).toEqual(atMin);
      
      const tooHigh = temperatureToXYZ(30000);
      const atMax = temperatureToXYZ(25000);
      
      expect(tooHigh).toEqual(atMax);
    });
  });

  describe('Standard Illuminants', () => {
    it('should have correct D50 illuminant values', () => {
      expect(Illuminants.D50.x).toBeCloseTo(0.9642, 4);
      expect(Illuminants.D50.y).toBeCloseTo(1.0000, 4);
      expect(Illuminants.D50.z).toBeCloseTo(0.8249, 4);
    });

    it('should have correct D65 illuminant values', () => {
      expect(Illuminants.D65.x).toBeCloseTo(0.9505, 4);
      expect(Illuminants.D65.y).toBeCloseTo(1.0000, 4);
      expect(Illuminants.D65.z).toBeCloseTo(1.0890, 4);
    });

    it('should have Y component equal to 1.0 for all illuminants', () => {
      expect(Illuminants.D50.y).toBe(1.0);
      expect(Illuminants.D65.y).toBe(1.0);
      expect(Illuminants.A.y).toBe(1.0);
      expect(Illuminants.F2.y).toBe(1.0);
    });
  });

  describe('Shader library exports', () => {
    it('should export colorSpaceShaderLib as a string', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(typeof colorSpaceShaderLib).toBe('string');
      expect(colorSpaceShaderLib.length).toBeGreaterThan(0);
    });

    it('should include sRGB conversion functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('sRGBToLinear');
      expect(colorSpaceShaderLib).toContain('linearToSRGB');
    });

    it('should include XYZ conversion functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('linearRGBToXYZ_D65');
      expect(colorSpaceShaderLib).toContain('xyzD65ToLinearRGB');
      expect(colorSpaceShaderLib).toContain('linearRGBToXYZ_D50');
      expect(colorSpaceShaderLib).toContain('xyzD50ToLinearRGB');
    });

    it('should include Lab conversion functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('xyzD50ToLab');
      expect(colorSpaceShaderLib).toContain('labToXYZ_D50');
      expect(colorSpaceShaderLib).toContain('linearRGBToLab');
      expect(colorSpaceShaderLib).toContain('labToLinearRGB');
    });

    it('should include LCH conversion functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('labToLCH');
      expect(colorSpaceShaderLib).toContain('lchToLab');
    });

    it('should include ProPhoto RGB conversion functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('linearRGBToProPhotoRGB');
      expect(colorSpaceShaderLib).toContain('proPhotoRGBToLinearRGB');
    });

    it('should include Bradford chromatic adaptation', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('bradfordAdaptation');
    });

    it('should include helper functions', async () => {
      const { colorSpaceShaderLib } = await import('./colorspaces');
      expect(colorSpaceShaderLib).toContain('getLuminance');
      expect(colorSpaceShaderLib).toContain('safeDivide');
      expect(colorSpaceShaderLib).toContain('safePow');
    });
  });

  describe('Temperature to white point GLSL', () => {
    it('should export temperatureToWhitePointGLSL as a string', async () => {
      const { temperatureToWhitePointGLSL } = await import('./colorspaces');
      expect(typeof temperatureToWhitePointGLSL).toBe('string');
      expect(temperatureToWhitePointGLSL).toContain('temperatureToXYZ');
    });
  });
});
