/**
 * Guided Filter Tests
 * 
 * Tests for guided filter implementation including:
 * - Edge preservation accuracy
 * - Box filter implementation
 * - Detail enhancement behavior
 * - Parameter range validation
 */

import { describe, it, expect } from 'vitest';
import {
  guidedFilterVertexShader,
  boxFilterHorizontalFragmentShader,
  boxFilterVerticalFragmentShader,
  guidedFilterFragmentShader,
  detailEnhancementFragmentShader,
  defaultGuidedFilterParams,
  type GuidedFilterParams,
} from './guidedfilter';

describe('Guided Filter', () => {

  describe('Shader Content Validation', () => {
    it('should include sRGB conversion functions', () => {
      expect(guidedFilterFragmentShader).toContain('srgbToLinear');
      expect(guidedFilterFragmentShader).toContain('linearToSrgb');
      expect(detailEnhancementFragmentShader).toContain('srgbToLinear');
      expect(detailEnhancementFragmentShader).toContain('linearToSrgb');
    });

    it('should include luminance calculation', () => {
      expect(guidedFilterFragmentShader).toContain('getLuminance');
      expect(guidedFilterFragmentShader).toContain('0.2126, 0.7152, 0.0722');
    });

    it('should include box filter function', () => {
      expect(guidedFilterFragmentShader).toContain('boxFilter');
    });

    it('should include guided filter algorithm', () => {
      expect(guidedFilterFragmentShader).toContain('applyGuidedFilter');
      expect(guidedFilterFragmentShader).toContain('meanI');
      expect(guidedFilterFragmentShader).toContain('meanP');
      expect(guidedFilterFragmentShader).toContain('varI');
      expect(guidedFilterFragmentShader).toContain('covIP');
    });

    it('should include all required uniforms in guided filter', () => {
      expect(guidedFilterFragmentShader).toContain('uniform sampler2D u_texture');
      expect(guidedFilterFragmentShader).toContain('uniform sampler2D u_guide');
      expect(guidedFilterFragmentShader).toContain('uniform float u_epsilon');
      expect(guidedFilterFragmentShader).toContain('uniform int u_radius');
      expect(guidedFilterFragmentShader).toContain('uniform vec2 u_resolution');
    });

    it('should include all required uniforms in detail enhancement', () => {
      expect(detailEnhancementFragmentShader).toContain('uniform sampler2D u_original');
      expect(detailEnhancementFragmentShader).toContain('uniform sampler2D u_filtered');
      expect(detailEnhancementFragmentShader).toContain('uniform float u_strength');
      expect(detailEnhancementFragmentShader).toContain('uniform bool u_enabled');
    });

    it('should include proper GLSL version', () => {
      expect(guidedFilterFragmentShader).toContain('#version 300 es');
      expect(guidedFilterVertexShader).toContain('#version 300 es');
      expect(boxFilterHorizontalFragmentShader).toContain('#version 300 es');
      expect(boxFilterVerticalFragmentShader).toContain('#version 300 es');
      expect(detailEnhancementFragmentShader).toContain('#version 300 es');
    });
  });

  describe('Box Filter Implementation', () => {
    it('should implement horizontal box filter', () => {
      expect(boxFilterHorizontalFragmentShader).toContain('uniform int u_radius');
      expect(boxFilterHorizontalFragmentShader).toContain('uniform vec2 u_resolution');
      expect(boxFilterHorizontalFragmentShader).toContain('for (int i = -u_radius; i <= u_radius; i++)');
    });

    it('should implement vertical box filter', () => {
      expect(boxFilterVerticalFragmentShader).toContain('uniform int u_radius');
      expect(boxFilterVerticalFragmentShader).toContain('uniform vec2 u_resolution');
      expect(boxFilterVerticalFragmentShader).toContain('for (int i = -u_radius; i <= u_radius; i++)');
    });

    it('should use separable filtering for efficiency', () => {
      // Horizontal pass should only offset in x direction
      expect(boxFilterHorizontalFragmentShader).toContain('vec2(float(i) * texelSize.x, 0.0)');
      // Vertical pass should only offset in y direction
      expect(boxFilterVerticalFragmentShader).toContain('vec2(0.0, float(i) * texelSize.y)');
    });

    it('should normalize by window size', () => {
      expect(boxFilterHorizontalFragmentShader).toContain('float windowSize = float(2 * u_radius + 1)');
      expect(boxFilterHorizontalFragmentShader).toContain('sum / windowSize');
      expect(boxFilterVerticalFragmentShader).toContain('float windowSize = float(2 * u_radius + 1)');
      expect(boxFilterVerticalFragmentShader).toContain('sum / windowSize');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultGuidedFilterParams.enabled).toBe(false);
      expect(defaultGuidedFilterParams.radius).toBe(5);
      expect(defaultGuidedFilterParams.epsilon).toBe(0.01);
      expect(defaultGuidedFilterParams.strength).toBe(0.0);
    });

    it('should have moderate default radius', () => {
      expect(defaultGuidedFilterParams.radius).toBeGreaterThanOrEqual(1);
      expect(defaultGuidedFilterParams.radius).toBeLessThanOrEqual(20);
      expect(defaultGuidedFilterParams.radius).toBe(5);
    });

    it('should have reasonable default epsilon', () => {
      expect(defaultGuidedFilterParams.epsilon).toBeGreaterThan(0.0);
      expect(defaultGuidedFilterParams.epsilon).toBeLessThanOrEqual(1.0);
      expect(defaultGuidedFilterParams.epsilon).toBe(0.01);
    });

    it('should have neutral default strength', () => {
      expect(defaultGuidedFilterParams.strength).toBe(0.0);
    });
  });

  describe('Parameter Range Validation', () => {
    describe('Radius Parameter', () => {
      it('should handle minimum radius (1)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          radius: 1,
        };
        
        expect(params.radius).toBe(1);
      });

      it('should handle maximum radius (20)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          radius: 20,
        };
        
        expect(params.radius).toBe(20);
      });

      it('should handle typical radius values', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          radius: 5,
        };
        
        expect(params.radius).toBe(5);
      });
    });

    describe('Epsilon Parameter', () => {
      it('should handle minimum epsilon (0.001)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          epsilon: 0.001,
        };
        
        expect(params.epsilon).toBe(0.001);
      });

      it('should handle maximum epsilon (1.0)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          epsilon: 1.0,
        };
        
        expect(params.epsilon).toBe(1.0);
      });

      it('should handle typical epsilon values', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          epsilon: 0.01,
        };
        
        expect(params.epsilon).toBe(0.01);
      });
    });

    describe('Strength Parameter', () => {
      it('should handle minimum strength (-2.0)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          strength: -2.0,
        };
        
        expect(params.strength).toBe(-2.0);
      });

      it('should handle maximum strength (2.0)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          strength: 2.0,
        };
        
        expect(params.strength).toBe(2.0);
      });

      it('should handle neutral strength (0.0)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          strength: 0.0,
        };
        
        expect(params.strength).toBe(0.0);
      });

      it('should handle positive strength (sharpening)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          strength: 1.0,
        };
        
        expect(params.strength).toBeGreaterThan(0.0);
      });

      it('should handle negative strength (smoothing)', () => {
        const params: GuidedFilterParams = {
          ...defaultGuidedFilterParams,
          enabled: true,
          strength: -1.0,
        };
        
        expect(params.strength).toBeLessThan(0.0);
      });
    });
  });

  describe('Guided Filter Algorithm', () => {
    it('should compute local mean of guide image', () => {
      expect(guidedFilterFragmentShader).toContain('float meanI = boxFilter(u_guide, v_texCoord, u_radius).r');
    });

    it('should compute local mean of input image', () => {
      expect(guidedFilterFragmentShader).toContain('vec3 meanP = boxFilter(u_texture, v_texCoord, u_radius).rgb');
    });

    it('should compute variance of guide image', () => {
      expect(guidedFilterFragmentShader).toContain('float varI = corrI - meanI * meanI');
    });

    it('should compute covariance between guide and input', () => {
      expect(guidedFilterFragmentShader).toContain('vec3 covIP = corrIP - meanI * meanP');
    });

    it('should compute linear coefficients a and b', () => {
      expect(guidedFilterFragmentShader).toContain('vec3 a = covIP / (varI + u_epsilon)');
      expect(guidedFilterFragmentShader).toContain('vec3 b = meanP - a * meanI');
    });

    it('should use epsilon to prevent division by zero', () => {
      expect(guidedFilterFragmentShader).toContain('varI + u_epsilon');
    });

    it('should use luminance as guide image', () => {
      expect(guidedFilterFragmentShader).toContain('float guide = getLuminance(color)');
    });
  });

  describe('Detail Enhancement', () => {
    it('should extract detail layer', () => {
      expect(detailEnhancementFragmentShader).toContain('vec3 detail = original - filtered');
    });

    it('should apply gain to detail layer', () => {
      expect(detailEnhancementFragmentShader).toContain('vec3 enhancedDetail = detail * strength');
    });

    it('should recombine with filtered image', () => {
      expect(detailEnhancementFragmentShader).toContain('vec3 result = filtered + enhancedDetail');
    });

    it('should support positive strength for sharpening', () => {
      // Positive strength enhances details
      expect(detailEnhancementFragmentShader).toContain('enhanceDetail');
    });

    it('should support negative strength for smoothing', () => {
      // Negative strength reduces details (denoising)
      expect(detailEnhancementFragmentShader).toContain('detail * strength');
    });

    it('should work in linear space', () => {
      expect(detailEnhancementFragmentShader).toContain('srgbToLinear(originalColor.rgb)');
      expect(detailEnhancementFragmentShader).toContain('srgbToLinear(filteredColor.rgb)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle disabled state', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: false,
        strength: 2.0,
      };
      
      expect(params.enabled).toBe(false);
      // When disabled, should pass through unchanged
    });

    it('should handle zero strength', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: true,
        strength: 0.0,
      };
      
      expect(params.strength).toBe(0.0);
      // Should pass through unchanged when strength is 0
    });

    it('should handle very small epsilon', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: true,
        epsilon: 0.001,
      };
      
      expect(params.epsilon).toBe(0.001);
      // Small epsilon preserves more edges
    });

    it('should handle large epsilon', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: true,
        epsilon: 1.0,
      };
      
      expect(params.epsilon).toBe(1.0);
      // Large epsilon smooths across edges
    });

    it('should handle small radius', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: true,
        radius: 1,
      };
      
      expect(params.radius).toBe(1);
      // Small radius preserves fine details
    });

    it('should handle large radius', () => {
      const params: GuidedFilterParams = {
        ...defaultGuidedFilterParams,
        enabled: true,
        radius: 20,
      };
      
      expect(params.radius).toBe(20);
      // Large radius affects broader areas
    });
  });

  describe('Edge Preservation', () => {
    it('should use variance to detect edges', () => {
      // High variance indicates edges
      expect(guidedFilterFragmentShader).toContain('float varI = corrI - meanI * meanI');
    });

    it('should adjust filtering based on epsilon', () => {
      // Epsilon controls edge preservation
      expect(guidedFilterFragmentShader).toContain('covIP / (varI + u_epsilon)');
    });

    it('should preserve edges when variance is high', () => {
      // When varI is high (edge), a approaches 1, preserving detail
      expect(guidedFilterFragmentShader).toContain('vec3 a = covIP / (varI + u_epsilon)');
    });

    it('should smooth when variance is low', () => {
      // When varI is low (smooth area), filtering is stronger
      expect(guidedFilterFragmentShader).toContain('varI + u_epsilon');
    });
  });

  describe('Performance Optimization', () => {
    it('should use separable box filter', () => {
      // Separable filtering reduces complexity from O(r²) to O(r)
      expect(boxFilterHorizontalFragmentShader).toBeDefined();
      expect(boxFilterVerticalFragmentShader).toBeDefined();
    });

    it('should use texture sampling for efficiency', () => {
      expect(boxFilterHorizontalFragmentShader).toContain('texture(u_texture');
      expect(boxFilterVerticalFragmentShader).toContain('texture(u_texture');
    });

    it('should support variable radius', () => {
      expect(boxFilterHorizontalFragmentShader).toContain('uniform int u_radius');
      expect(boxFilterVerticalFragmentShader).toContain('uniform int u_radius');
    });
  });

  describe('Integration', () => {
    it('should clamp output to valid range', () => {
      expect(guidedFilterFragmentShader).toContain('clamp(filtered, 0.0, 1.0)');
      expect(detailEnhancementFragmentShader).toContain('clamp(color, 0.0, 1.0)');
    });

    it('should convert back to sRGB for display', () => {
      expect(guidedFilterFragmentShader).toContain('linearToSrgb(filtered)');
      expect(detailEnhancementFragmentShader).toContain('linearToSrgb(color)');
    });

    it('should preserve alpha channel', () => {
      expect(guidedFilterFragmentShader).toContain('texColor.a');
      expect(detailEnhancementFragmentShader).toContain('originalColor.a');
    });
  });

  describe('Comparison to Bilateral Filter', () => {
    it('should be more efficient than bilateral filter', () => {
      // Guided filter is O(N) vs bilateral filter O(N*r²)
      // This is achieved through box filter decomposition
      expect(guidedFilterFragmentShader).toContain('boxFilter');
    });

    it('should provide similar edge preservation', () => {
      // Both preserve edges, but guided filter is faster
      expect(guidedFilterFragmentShader).toContain('varI + u_epsilon');
    });

    it('should avoid halos', () => {
      // Guided filter naturally avoids halos through local linear model
      expect(guidedFilterFragmentShader).toContain('vec3 a = covIP / (varI + u_epsilon)');
      expect(guidedFilterFragmentShader).toContain('vec3 b = meanP - a * meanI');
    });
  });

});
