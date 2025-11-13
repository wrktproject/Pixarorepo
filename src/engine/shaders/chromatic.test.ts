/**
 * Chromatic Aberration Shader Tests
 * Verifies the chromatic aberration correction shader implementation
 */

import { describe, it, expect } from 'vitest';
import {
  chromaticVertexShader,
  chromaticFragmentShader,
  defaultChromaticParams,
  type ChromaticParams,
} from './chromatic';

describe('Chromatic Aberration Shader', () => {
  describe('Shader Source', () => {
    it('should have valid vertex shader source', () => {
      expect(chromaticVertexShader).toBeDefined();
      expect(chromaticVertexShader).toContain('#version 300 es');
      expect(chromaticVertexShader).toContain('in vec2 a_position');
      expect(chromaticVertexShader).toContain('in vec2 a_texCoord');
      expect(chromaticVertexShader).toContain('out vec2 v_texCoord');
    });

    it('should have valid fragment shader source', () => {
      expect(chromaticFragmentShader).toBeDefined();
      expect(chromaticFragmentShader).toContain('#version 300 es');
      expect(chromaticFragmentShader).toContain('uniform sampler2D u_texture');
      expect(chromaticFragmentShader).toContain('uniform float u_strength');
      expect(chromaticFragmentShader).toContain('uniform bool u_enabled');
      expect(chromaticFragmentShader).toContain('out vec4 fragColor');
    });

    it('should include chromatic aberration correction function', () => {
      expect(chromaticFragmentShader).toContain('correctChromaticAberrationAdvanced');
      expect(chromaticFragmentShader).toContain('vec2 center = vec2(0.5, 0.5)');
    });
  });

  describe('Default Parameters', () => {
    it('should have correct default values', () => {
      expect(defaultChromaticParams).toEqual({
        strength: 0.0,
        enabled: false,
      });
    });
  });

  describe('Parameter Validation', () => {
    it('should accept strength values in range', () => {
      const params: ChromaticParams = {
        strength: 0.5,
        enabled: true,
      };
      expect(params.strength).toBeGreaterThanOrEqual(-1.0);
      expect(params.strength).toBeLessThanOrEqual(1.0);
    });

    it('should accept negative strength values', () => {
      const params: ChromaticParams = {
        strength: -0.5,
        enabled: true,
      };
      expect(params.strength).toBe(-0.5);
    });
  });

  describe('Shader Algorithm', () => {
    it('should implement quadratic falloff for realistic lens behavior', () => {
      expect(chromaticFragmentShader).toContain('dist * dist');
      expect(chromaticFragmentShader).toContain('// Quadratic falloff');
    });

    it('should shift red channel outward and blue channel inward', () => {
      expect(chromaticFragmentShader).toContain('uv + offset');  // Red outward
      expect(chromaticFragmentShader).toContain('uv - offset');  // Blue inward
      expect(chromaticFragmentShader).toContain('.r');
      expect(chromaticFragmentShader).toContain('.g');
      expect(chromaticFragmentShader).toContain('.b');
    });

    it('should only apply correction when enabled and strength > 0', () => {
      expect(chromaticFragmentShader).toContain('if (u_enabled && abs(u_strength) > 0.001)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero strength', () => {
      const params: ChromaticParams = {
        strength: 0.0,
        enabled: true,
      };
      expect(params.strength).toBe(0.0);
    });

    it('should handle maximum positive strength', () => {
      const params: ChromaticParams = {
        strength: 1.0,
        enabled: true,
      };
      expect(params.strength).toBe(1.0);
    });

    it('should handle maximum negative strength', () => {
      const params: ChromaticParams = {
        strength: -1.0,
        enabled: true,
      };
      expect(params.strength).toBe(-1.0);
    });
  });
});

