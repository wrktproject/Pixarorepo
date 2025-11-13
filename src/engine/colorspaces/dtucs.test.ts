/**
 * DT UCS 2022 Color Space Tests
 * 
 * Tests for DT UCS (Darktable Uniform Color Space) conversions
 */

import { describe, it, expect } from 'vitest';
import { dtUCSShaderLib, defaultColorBalanceParams } from './dtucs';

describe('DT UCS 2022 Color Space', () => {
  describe('Shader library exports', () => {
    it('should export dtUCSShaderLib as a string', () => {
      expect(typeof dtUCSShaderLib).toBe('string');
      expect(dtUCSShaderLib.length).toBeGreaterThan(0);
    });

    it('should include DT UCS conversion functions', () => {
      expect(dtUCSShaderLib).toContain('linearRGBToDTUCS');
      expect(dtUCSShaderLib).toContain('dtucsToLinearRGB');
    });

    it('should include chroma adjustment function', () => {
      expect(dtUCSShaderLib).toContain('adjustChromaDTUCS');
    });

    it('should include lightness adjustment function', () => {
      expect(dtUCSShaderLib).toContain('adjustLightnessDTUCS');
    });

    it('should include hue rotation function', () => {
      expect(dtUCSShaderLib).toContain('rotateHueDTUCS');
    });

    it('should include color grading function', () => {
      expect(dtUCSShaderLib).toContain('colorGradeDTUCS');
    });

    it('should include luminance mask generation', () => {
      expect(dtUCSShaderLib).toContain('generateLuminanceMasks');
    });

    it('should include Color Balance RGB function', () => {
      expect(dtUCSShaderLib).toContain('applyColorBalanceRGB');
    });
  });

  describe('Default Color Balance parameters', () => {
    it('should have zero adjustments by default', () => {
      expect(defaultColorBalanceParams.shadows.lightness).toBe(0);
      expect(defaultColorBalanceParams.shadows.chroma).toBe(0);
      expect(defaultColorBalanceParams.shadows.hue).toBe(0);
      
      expect(defaultColorBalanceParams.midtones.lightness).toBe(0);
      expect(defaultColorBalanceParams.midtones.chroma).toBe(0);
      expect(defaultColorBalanceParams.midtones.hue).toBe(0);
      
      expect(defaultColorBalanceParams.highlights.lightness).toBe(0);
      expect(defaultColorBalanceParams.highlights.chroma).toBe(0);
      expect(defaultColorBalanceParams.highlights.hue).toBe(0);
      
      expect(defaultColorBalanceParams.global.lightness).toBe(0);
      expect(defaultColorBalanceParams.global.chroma).toBe(0);
      expect(defaultColorBalanceParams.global.hue).toBe(0);
    });

    it('should have correct default grey fulcrum (18.45%)', () => {
      expect(defaultColorBalanceParams.greyFulcrum).toBeCloseTo(0.1845, 4);
    });

    it('should have default mask weights of 1.0', () => {
      expect(defaultColorBalanceParams.shadowsWeight).toBe(1.0);
      expect(defaultColorBalanceParams.highlightsWeight).toBe(1.0);
    });
  });

  describe('Color Balance parameter structure', () => {
    it('should have all required zone properties', () => {
      const zones = ['shadows', 'midtones', 'highlights', 'global'] as const;
      
      zones.forEach(zone => {
        expect(defaultColorBalanceParams[zone]).toHaveProperty('lightness');
        expect(defaultColorBalanceParams[zone]).toHaveProperty('chroma');
        expect(defaultColorBalanceParams[zone]).toHaveProperty('hue');
      });
    });

    it('should have mask control properties', () => {
      expect(defaultColorBalanceParams).toHaveProperty('greyFulcrum');
      expect(defaultColorBalanceParams).toHaveProperty('shadowsWeight');
      expect(defaultColorBalanceParams).toHaveProperty('highlightsWeight');
    });
  });
});
