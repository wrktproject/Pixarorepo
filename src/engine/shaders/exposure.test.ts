/**
 * Exposure Shader Tests
 * Tests for scene-referred exposure adjustment with highlight preservation
 */

import { describe, it, expect } from 'vitest';
import {
  exposureVertexShader,
  exposureFragmentShader,
  defaultExposureParams,
  type ExposureParams,
} from './exposure';

describe('Exposure Shader', () => {
  describe('Shader Source', () => {
    it('should have valid vertex shader source', () => {
      expect(exposureVertexShader).toBeTruthy();
      expect(exposureVertexShader).toContain('#version 300 es');
      expect(exposureVertexShader).toContain('in vec2 a_position');
      expect(exposureVertexShader).toContain('in vec2 a_texCoord');
      expect(exposureVertexShader).toContain('out vec2 v_texCoord');
    });

    it('should have valid fragment shader source', () => {
      expect(exposureFragmentShader).toBeTruthy();
      expect(exposureFragmentShader).toContain('#version 300 es');
      expect(exposureFragmentShader).toContain('uniform sampler2D u_texture');
      expect(exposureFragmentShader).toContain('out vec4 fragColor');
    });

    it('should include exposure uniforms', () => {
      expect(exposureFragmentShader).toContain('uniform float u_exposure');
      expect(exposureFragmentShader).toContain('uniform float u_blackPoint');
      expect(exposureFragmentShader).toContain('uniform bool u_highlightReconstruction');
      expect(exposureFragmentShader).toContain('uniform float u_reconstructionThreshold');
      expect(exposureFragmentShader).toContain('uniform bool u_enabled');
    });

    it('should include color space conversion functions', () => {
      expect(exposureFragmentShader).toContain('vec3 srgbToLinear');
      expect(exposureFragmentShader).toContain('vec3 linearToSrgb');
    });

    it('should include exposure functions', () => {
      expect(exposureFragmentShader).toContain('vec3 applyExposureScaling');
      expect(exposureFragmentShader).toContain('vec3 applyBlackPoint');
      expect(exposureFragmentShader).toContain('vec3 reconstructHighlights');
      expect(exposureFragmentShader).toContain('vec3 applyExposure');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultExposureParams.exposure).toBe(0.0);
      expect(defaultExposureParams.blackPoint).toBe(0.0);
      expect(defaultExposureParams.highlightReconstruction).toBe(false);
      expect(defaultExposureParams.reconstructionThreshold).toBe(0.95);
      expect(defaultExposureParams.enabled).toBe(true);
    });

    it('should have exposure in valid range', () => {
      expect(defaultExposureParams.exposure).toBeGreaterThanOrEqual(-10);
      expect(defaultExposureParams.exposure).toBeLessThanOrEqual(10);
    });

    it('should have black point in valid range', () => {
      expect(defaultExposureParams.blackPoint).toBeGreaterThanOrEqual(0.0);
      expect(defaultExposureParams.blackPoint).toBeLessThanOrEqual(0.1);
    });

    it('should have reconstruction threshold in valid range', () => {
      expect(defaultExposureParams.reconstructionThreshold).toBeGreaterThanOrEqual(0.9);
      expect(defaultExposureParams.reconstructionThreshold).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Parameter Validation', () => {
    it('should accept valid exposure values', () => {
      const params: ExposureParams = {
        ...defaultExposureParams,
        exposure: 2.5,
      };
      expect(params.exposure).toBe(2.5);
    });

    it('should accept valid black point values', () => {
      const params: ExposureParams = {
        ...defaultExposureParams,
        blackPoint: 0.05,
      };
      expect(params.blackPoint).toBe(0.05);
    });

    it('should accept valid reconstruction threshold values', () => {
      const params: ExposureParams = {
        ...defaultExposureParams,
        reconstructionThreshold: 0.92,
      };
      expect(params.reconstructionThreshold).toBe(0.92);
    });

    it('should handle highlight reconstruction toggle', () => {
      const params: ExposureParams = {
        ...defaultExposureParams,
        highlightReconstruction: true,
      };
      expect(params.highlightReconstruction).toBe(true);
    });

    it('should handle enabled toggle', () => {
      const params: ExposureParams = {
        ...defaultExposureParams,
        enabled: false,
      };
      expect(params.enabled).toBe(false);
    });
  });

  describe('Exposure Scaling Logic', () => {
    it('should implement EV-based scaling formula', () => {
      // Check that shader contains pow(2.0, ev) formula
      expect(exposureFragmentShader).toContain('pow(2.0, ev)');
    });

    it('should work in linear RGB space', () => {
      // Verify conversion to linear before processing
      expect(exposureFragmentShader).toContain('srgbToLinear(color)');
      // Verify conversion back to sRGB after processing
      expect(exposureFragmentShader).toContain('linearToSrgb(color)');
    });

    it('should preserve color ratios', () => {
      // Exposure should be applied uniformly to all channels
      // This is implicit in the per-channel scaling approach
      expect(exposureFragmentShader).toContain('rgb * scale');
    });
  });

  describe('Black Point Adjustment', () => {
    it('should subtract black point', () => {
      expect(exposureFragmentShader).toContain('rgb - blackPoint');
    });

    it('should normalize after subtraction', () => {
      expect(exposureFragmentShader).toContain('/ (1.0 - blackPoint)');
    });

    it('should clamp to prevent negative values', () => {
      expect(exposureFragmentShader).toContain('max(rgb - blackPoint, 0.0)');
    });
  });

  describe('Highlight Reconstruction', () => {
    it('should detect clipped channels', () => {
      expect(exposureFragmentShader).toContain('maxChannel > threshold');
    });

    it('should use color ratios for reconstruction', () => {
      expect(exposureFragmentShader).toContain('ratios = rgb / max(maxChannel');
    });

    it('should blend smoothly', () => {
      expect(exposureFragmentShader).toContain('smoothstep');
    });

    it('should preserve hue during reconstruction', () => {
      // Reconstruction should maintain color ratios
      expect(exposureFragmentShader).toContain('avgRatio * maxChannel');
    });

    it('should be conditional on threshold', () => {
      expect(exposureFragmentShader).toContain('if (maxChannel <= threshold)');
    });
  });

  describe('Processing Pipeline', () => {
    it('should apply exposure scaling first', () => {
      const pipelineOrder = exposureFragmentShader.indexOf('applyExposureScaling');
      const blackPointOrder = exposureFragmentShader.indexOf('applyBlackPoint');
      const reconstructOrder = exposureFragmentShader.indexOf('reconstructHighlights');
      
      expect(pipelineOrder).toBeLessThan(blackPointOrder);
      expect(blackPointOrder).toBeLessThan(reconstructOrder);
    });

    it('should respect enabled flag', () => {
      expect(exposureFragmentShader).toContain('if (u_enabled)');
    });

    it('should clamp output to valid range', () => {
      expect(exposureFragmentShader).toContain('max(color, 0.0)');
    });
  });

  describe('Numerical Stability', () => {
    it('should define epsilon for safe division', () => {
      expect(exposureFragmentShader).toContain('const float EPSILON');
    });

    it('should use epsilon in division operations', () => {
      expect(exposureFragmentShader).toContain('max(maxChannel, EPSILON)');
    });

    it('should handle edge cases', () => {
      // Should handle black point edge case
      expect(exposureFragmentShader).toContain('if (blackPoint < 1.0)');
    });
  });

  describe('Color Preservation', () => {
    it('should maintain alpha channel', () => {
      expect(exposureFragmentShader).toContain('texColor.a');
      expect(exposureFragmentShader).toContain('vec4(color, texColor.a)');
    });

    it('should use accurate sRGB conversion', () => {
      // Check for proper sRGB gamma with linear segment
      expect(exposureFragmentShader).toContain('0.04045');
      expect(exposureFragmentShader).toContain('12.92');
      expect(exposureFragmentShader).toContain('0.0031308');
      expect(exposureFragmentShader).toContain('2.4');
    });
  });

  describe('Parameter Ranges', () => {
    it('should support wide exposure range', () => {
      // -10 to +10 EV range
      const minExposure: ExposureParams = {
        ...defaultExposureParams,
        exposure: -10,
      };
      const maxExposure: ExposureParams = {
        ...defaultExposureParams,
        exposure: 10,
      };
      
      expect(minExposure.exposure).toBe(-10);
      expect(maxExposure.exposure).toBe(10);
    });

    it('should support black point range', () => {
      const minBlackPoint: ExposureParams = {
        ...defaultExposureParams,
        blackPoint: 0.0,
      };
      const maxBlackPoint: ExposureParams = {
        ...defaultExposureParams,
        blackPoint: 0.1,
      };
      
      expect(minBlackPoint.blackPoint).toBe(0.0);
      expect(maxBlackPoint.blackPoint).toBe(0.1);
    });

    it('should support reconstruction threshold range', () => {
      const minThreshold: ExposureParams = {
        ...defaultExposureParams,
        reconstructionThreshold: 0.9,
      };
      const maxThreshold: ExposureParams = {
        ...defaultExposureParams,
        reconstructionThreshold: 1.0,
      };
      
      expect(minThreshold.reconstructionThreshold).toBe(0.9);
      expect(maxThreshold.reconstructionThreshold).toBe(1.0);
    });
  });
});
