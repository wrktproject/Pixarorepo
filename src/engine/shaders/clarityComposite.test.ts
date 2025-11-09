/**
 * Tests for Clarity Composite Shader
 */

import { describe, it, expect } from 'vitest';
import {
  clarityCompositeVertexShader,
  clarityCompositeFragmentShader,
  applyClarityCompositeUniforms,
} from './clarityComposite';

describe('Clarity Composite Shader', () => {
  it('should export vertex shader', () => {
    expect(clarityCompositeVertexShader).toBeDefined();
    expect(clarityCompositeVertexShader).toContain('#version 300 es');
    expect(clarityCompositeVertexShader).toContain('in vec2 a_position');
    expect(clarityCompositeVertexShader).toContain('in vec2 a_texCoord');
    expect(clarityCompositeVertexShader).toContain('out vec2 v_texCoord');
  });

  it('should export fragment shader', () => {
    expect(clarityCompositeFragmentShader).toBeDefined();
    expect(clarityCompositeFragmentShader).toContain('#version 300 es');
    expect(clarityCompositeFragmentShader).toContain('uniform sampler2D u_original');
    expect(clarityCompositeFragmentShader).toContain('uniform sampler2D u_blurred');
    expect(clarityCompositeFragmentShader).toContain('uniform float u_clarity');
  });

  it('should implement high-pass filter', () => {
    expect(clarityCompositeFragmentShader).toContain('highpass = original - blurred');
  });

  it('should composite with user-controlled intensity', () => {
    expect(clarityCompositeFragmentShader).toContain('original + highpass * strength');
  });

  it('should clamp result to prevent artifacts', () => {
    expect(clarityCompositeFragmentShader).toContain('clamp(result, 0.0, 1.0)');
  });

  it('should normalize clarity amount', () => {
    expect(clarityCompositeFragmentShader).toContain('u_clarity / 100.0');
  });
});

describe('applyClarityCompositeUniforms', () => {
  it('should be a function', () => {
    expect(typeof applyClarityCompositeUniforms).toBe('function');
  });
});
