/**
 * JzAzBz Color Space Tests
 * 
 * Tests for JzAzBz perceptual color space conversions
 */

import { describe, it, expect } from 'vitest';
import { 
  jzAzBzShaderLib, 
  defaultSaturationParams, 
  degreesToRadians, 
  radiansToDegrees 
} from './jzazbz';

describe('JzAzBz Color Space', () => {
  describe('Shader library exports', () => {
    it('should export jzAzBzShaderLib as a string', () => {
      expect(typeof jzAzBzShaderLib).toBe('string');
      expect(jzAzBzShaderLib.length).toBeGreaterThan(0);
    });

    it('should include JzAzBz conversion functions', () => {
      expect(jzAzBzShaderLib).toContain('linearRGBToJzAzBz');
      expect(jzAzBzShaderLib).toContain('jzAzBzToLinearRGB');
    });

    it('should include JzCzHz cylindrical conversion functions', () => {
      expect(jzAzBzShaderLib).toContain('jzAzBzToJzCzHz');
      expect(jzAzBzShaderLib).toContain('jzCzHzToJzAzBz');
    });

    it('should include PQ EOTF functions', () => {
      expect(jzAzBzShaderLib).toContain('pqEOTF');
      expect(jzAzBzShaderLib).toContain('pqEOTFInv');
    });

    it('should include saturation adjustment function', () => {
      expect(jzAzBzShaderLib).toContain('applySaturationJzAzBz');
    });

    it('should include vibrance adjustment function', () => {
      expect(jzAzBzShaderLib).toContain('applyVibranceJzAzBz');
    });

    it('should include lightness adjustment function', () => {
      expect(jzAzBzShaderLib).toContain('adjustLightnessJzAzBz');
    });

    it('should include hue rotation function', () => {
      expect(jzAzBzShaderLib).toContain('rotateHueJzAzBz');
    });

    it('should include color grading function', () => {
      expect(jzAzBzShaderLib).toContain('colorGradeJzAzBz');
    });
  });

  describe('Default saturation parameters', () => {
    it('should have zero saturation by default', () => {
      expect(defaultSaturationParams.saturation).toBe(0);
    });

    it('should have zero vibrance by default', () => {
      expect(defaultSaturationParams.vibrance).toBe(0);
    });

    it('should have skin protection at 0.5 by default', () => {
      expect(defaultSaturationParams.skinProtection).toBe(0.5);
    });
  });

  describe('Angle conversion utilities', () => {
    it('should convert degrees to radians correctly', () => {
      expect(degreesToRadians(0)).toBe(0);
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10);
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('should convert radians to degrees correctly', () => {
      expect(radiansToDegrees(0)).toBe(0);
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
    });

    it('should round-trip degrees to radians to degrees', () => {
      const testAngles = [0, 30, 45, 60, 90, 120, 180, 270, 360];
      
      testAngles.forEach(angle => {
        const radians = degreesToRadians(angle);
        const backToDegrees = radiansToDegrees(radians);
        expect(backToDegrees).toBeCloseTo(angle, 10);
      });
    });

    it('should round-trip radians to degrees to radians', () => {
      const testRadians = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, 2 * Math.PI];
      
      testRadians.forEach(radian => {
        const degrees = radiansToDegrees(radian);
        const backToRadians = degreesToRadians(degrees);
        expect(backToRadians).toBeCloseTo(radian, 10);
      });
    });
  });

  describe('HDR support', () => {
    it('should document HDR support in shader comments', () => {
      expect(jzAzBzShaderLib).toContain('HDR');
      expect(jzAzBzShaderLib).toContain('> 1.0');
    });

    it('should include PQ transfer function for HDR', () => {
      // PQ (Perceptual Quantizer) is the ST.2084 HDR transfer function
      expect(jzAzBzShaderLib).toContain('ST.2084');
    });
  });
});
