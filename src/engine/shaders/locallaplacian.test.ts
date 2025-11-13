/**
 * Local Laplacian Filter Tests
 * Tests for multi-scale local contrast enhancement
 */

import { describe, it, expect } from 'vitest';
import {
  LocalLaplacianParams,
  defaultLocalLaplacianParams,
  calculateLevelGains,
  calculatePyramidDimensions,
  gaussianBlurHorizontalFragmentShader,
  gaussianBlurVerticalFragmentShader,
  downsampleFragmentShader,
  upsampleFragmentShader,
  laplacianFragmentShader,
  pyramidReconstructFragmentShader,
  localLaplacianFragmentShader,
} from './locallaplacian';

describe('Local Laplacian Filter', () => {
  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultLocalLaplacianParams.enabled).toBe(false);
      expect(defaultLocalLaplacianParams.detail).toBe(0.0);
      expect(defaultLocalLaplacianParams.coarse).toBe(0.0);
      expect(defaultLocalLaplacianParams.strength).toBe(1.0);
      expect(defaultLocalLaplacianParams.levels).toBe(4);
    });

    it('should have detail in valid range', () => {
      expect(defaultLocalLaplacianParams.detail).toBeGreaterThanOrEqual(-1.0);
      expect(defaultLocalLaplacianParams.detail).toBeLessThanOrEqual(1.0);
    });

    it('should have coarse in valid range', () => {
      expect(defaultLocalLaplacianParams.coarse).toBeGreaterThanOrEqual(-1.0);
      expect(defaultLocalLaplacianParams.coarse).toBeLessThanOrEqual(1.0);
    });

    it('should have strength in valid range', () => {
      expect(defaultLocalLaplacianParams.strength).toBeGreaterThanOrEqual(0.0);
      expect(defaultLocalLaplacianParams.strength).toBeLessThanOrEqual(2.0);
    });
  });

  describe('calculateLevelGains', () => {
    it('should return correct number of gains', () => {
      const params: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        levels: 4,
      };
      const gains = calculateLevelGains(params);
      expect(gains).toHaveLength(4);
    });

    it('should return unity gains for default parameters', () => {
      const params: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 0.0,
        coarse: 0.0,
        strength: 1.0,
      };
      const gains = calculateLevelGains(params);
      gains.forEach(gain => {
        expect(gain).toBeCloseTo(1.0, 5);
      });
    });

    it('should interpolate between detail and coarse', () => {
      const params: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 1.0,
        coarse: 0.0,
        strength: 1.0,
        levels: 4,
      };
      const gains = calculateLevelGains(params);
      
      // First level (finest) should have highest gain
      expect(gains[0]).toBeGreaterThan(gains[gains.length - 1]);
      
      // Gains should decrease monotonically
      for (let i = 0; i < gains.length - 1; i++) {
        expect(gains[i]).toBeGreaterThanOrEqual(gains[i + 1]);
      }
    });

    it('should apply strength multiplier correctly', () => {
      const params1: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 0.5,
        coarse: 0.5,
        strength: 1.0,
        levels: 4,
      };
      const params2: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 0.5,
        coarse: 0.5,
        strength: 2.0,
        levels: 4,
      };
      
      const gains1 = calculateLevelGains(params1);
      const gains2 = calculateLevelGains(params2);
      
      // Gains with 2x strength should be further from 1.0
      for (let i = 0; i < gains1.length; i++) {
        const diff1 = Math.abs(gains1[i] - 1.0);
        const diff2 = Math.abs(gains2[i] - 1.0);
        expect(diff2).toBeGreaterThan(diff1);
      }
    });

    it('should handle negative detail (smoothing)', () => {
      const params: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: -0.5,
        coarse: 0.0,
        strength: 1.0,
        levels: 4,
      };
      const gains = calculateLevelGains(params);
      
      // First level should have gain < 1.0 (smoothing)
      expect(gains[0]).toBeLessThan(1.0);
    });

    it('should handle positive coarse (enhancement)', () => {
      const params: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 0.0,
        coarse: 0.5,
        strength: 1.0,
        levels: 4,
      };
      const gains = calculateLevelGains(params);
      
      // Last level should have gain > 1.0 (enhancement)
      expect(gains[gains.length - 1]).toBeGreaterThan(1.0);
    });
  });

  describe('calculatePyramidDimensions', () => {
    it('should calculate correct number of levels', () => {
      const dimensions = calculatePyramidDimensions(1920, 1080, 4);
      expect(dimensions).toHaveLength(4);
    });

    it('should halve dimensions at each level', () => {
      const dimensions = calculatePyramidDimensions(1920, 1080, 4);
      
      expect(dimensions[0]).toEqual({ width: 1920, height: 1080 });
      expect(dimensions[1]).toEqual({ width: 960, height: 540 });
      expect(dimensions[2]).toEqual({ width: 480, height: 270 });
      expect(dimensions[3]).toEqual({ width: 240, height: 135 });
    });

    it('should handle odd dimensions correctly', () => {
      const dimensions = calculatePyramidDimensions(1921, 1081, 3);
      
      expect(dimensions[0]).toEqual({ width: 1921, height: 1081 });
      expect(dimensions[1]).toEqual({ width: 960, height: 540 });
      expect(dimensions[2]).toEqual({ width: 480, height: 270 });
    });

    it('should not go below 1 pixel', () => {
      const dimensions = calculatePyramidDimensions(8, 8, 10);
      
      // Check that no dimension is less than 1
      dimensions.forEach(dim => {
        expect(dim.width).toBeGreaterThanOrEqual(1);
        expect(dim.height).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle small images', () => {
      const dimensions = calculatePyramidDimensions(16, 16, 4);
      
      expect(dimensions[0]).toEqual({ width: 16, height: 16 });
      expect(dimensions[1]).toEqual({ width: 8, height: 8 });
      expect(dimensions[2]).toEqual({ width: 4, height: 4 });
      expect(dimensions[3]).toEqual({ width: 2, height: 2 });
    });

    it('should handle rectangular images', () => {
      const dimensions = calculatePyramidDimensions(3840, 1080, 3);
      
      expect(dimensions[0]).toEqual({ width: 3840, height: 1080 });
      expect(dimensions[1]).toEqual({ width: 1920, height: 540 });
      expect(dimensions[2]).toEqual({ width: 960, height: 270 });
    });
  });

  describe('Shader Code Validation', () => {
    it('should have valid GLSL version directive', () => {
      // Check all shaders have GLSL 300 es version
      expect(gaussianBlurHorizontalFragmentShader).toContain('#version 300 es');
      expect(gaussianBlurVerticalFragmentShader).toContain('#version 300 es');
      expect(downsampleFragmentShader).toContain('#version 300 es');
      expect(upsampleFragmentShader).toContain('#version 300 es');
      expect(laplacianFragmentShader).toContain('#version 300 es');
      expect(pyramidReconstructFragmentShader).toContain('#version 300 es');
      expect(localLaplacianFragmentShader).toContain('#version 300 es');
    });

    it('should have required uniforms in shaders', () => {
      // Gaussian blur should have texture and resolution uniforms
      expect(gaussianBlurHorizontalFragmentShader).toContain('uniform sampler2D u_texture');
      expect(gaussianBlurHorizontalFragmentShader).toContain('uniform vec2 u_resolution');

      // Laplacian should have current and coarser level uniforms
      expect(laplacianFragmentShader).toContain('uniform sampler2D u_currentLevel');
      expect(laplacianFragmentShader).toContain('uniform sampler2D u_coarserLevel');

      // Reconstruction should have coarser level and laplacian uniforms
      expect(pyramidReconstructFragmentShader).toContain('uniform sampler2D u_coarserLevel');
      expect(pyramidReconstructFragmentShader).toContain('uniform sampler2D u_laplacian');
    });
  });

  describe('Multi-scale Processing', () => {
    it('should support 3-4 pyramid levels', () => {
      const params3: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        levels: 3,
      };
      const params4: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        levels: 4,
      };

      const gains3 = calculateLevelGains(params3);
      const gains4 = calculateLevelGains(params4);

      expect(gains3).toHaveLength(3);
      expect(gains4).toHaveLength(4);
    });

    it('should handle different frequency bands independently', () => {
      // Test that fine and coarse controls affect different levels
      const fineParams: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 1.0,
        coarse: 0.0,
        strength: 1.0,
        levels: 4,
      };
      const coarseParams: LocalLaplacianParams = {
        ...defaultLocalLaplacianParams,
        detail: 0.0,
        coarse: 1.0,
        strength: 1.0,
        levels: 4,
      };

      const fineGains = calculateLevelGains(fineParams);
      const coarseGains = calculateLevelGains(coarseParams);

      // Fine should affect first level more
      expect(fineGains[0] - 1.0).toBeGreaterThan(coarseGains[0] - 1.0);
      
      // Coarse should affect last level more
      expect(coarseGains[3] - 1.0).toBeGreaterThan(fineGains[3] - 1.0);
    });
  });
});
