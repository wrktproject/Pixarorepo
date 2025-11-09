/**
 * Shader Warm-up
 * Pre-compiles shaders on app load to reduce first-render latency
 */

import { ShaderCompiler } from './shaderUtils';
import {
  baseVertexShader,
  baseFragmentShader,
} from './shaders/base';
import { tonalVertexShader, tonalFragmentShader } from './shaders/tonal';
import { colorVertexShader, colorFragmentShader } from './shaders/color';
import { hslVertexShader, hslFragmentShader } from './shaders/hsl';
import { detailVertexShader, detailFragmentShader } from './shaders/detail';
import { effectsVertexShader, effectsFragmentShader } from './shaders/effects';
import { geometricVertexShader, geometricFragmentShader } from './shaders/geometric';

export interface WarmupConfig {
  onProgress?: (current: number, total: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Warm up all shaders by pre-compiling them
 */
export async function warmupShaders(
  compiler: ShaderCompiler,
  config: WarmupConfig = {}
): Promise<void> {
  const { onProgress, onComplete, onError } = config;

  const shaderDefinitions = [
    {
      name: 'base',
      vertex: baseVertexShader,
      fragment: baseFragmentShader,
      uniforms: ['u_texture'],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'geometric',
      vertex: geometricVertexShader,
      fragment: geometricFragmentShader,
      uniforms: ['u_texture', 'u_imageSize', 'u_cropBounds', 'u_rotationAngle', 'u_hasCrop'],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'tonal',
      vertex: tonalVertexShader,
      fragment: tonalFragmentShader,
      uniforms: [
        'u_texture',
        'u_exposure',
        'u_contrast',
        'u_highlights',
        'u_shadows',
        'u_whites',
        'u_blacks',
      ],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'color',
      vertex: colorVertexShader,
      fragment: colorFragmentShader,
      uniforms: ['u_texture', 'u_temperature', 'u_tint', 'u_vibrance', 'u_saturation'],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'hsl',
      vertex: hslVertexShader,
      fragment: hslFragmentShader,
      uniforms: [
        'u_texture',
        'u_red',
        'u_orange',
        'u_yellow',
        'u_green',
        'u_aqua',
        'u_blue',
        'u_purple',
        'u_magenta',
      ],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'detail',
      vertex: detailVertexShader,
      fragment: detailFragmentShader,
      uniforms: [
        'u_texture',
        'u_texelSize',
        'u_sharpening',
        'u_clarity',
        'u_noiseReductionLuma',
        'u_noiseReductionColor',
      ],
      attributes: ['a_position', 'a_texCoord'],
    },
    {
      name: 'effects',
      vertex: effectsVertexShader,
      fragment: effectsFragmentShader,
      uniforms: [
        'u_texture',
        'u_vignetteAmount',
        'u_vignetteMidpoint',
        'u_vignetteFeather',
        'u_grainAmount',
        'u_grainSize',
        'u_time',
      ],
      attributes: ['a_position', 'a_texCoord'],
    },
  ];

  const total = shaderDefinitions.length;

  try {
    for (let i = 0; i < shaderDefinitions.length; i++) {
      const def = shaderDefinitions[i];

      // Compile shader program (will be cached)
      compiler.createProgram(
        def.vertex,
        def.fragment,
        def.uniforms,
        def.attributes
      );

      // Report progress
      if (onProgress) {
        onProgress(i + 1, total);
      }

      // Yield to browser to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (onComplete) {
      onComplete();
    }
  } catch (error) {
    if (onError) {
      onError(error as Error);
    } else {
      console.error('Shader warm-up failed:', error);
    }
  }
}

/**
 * Check if shaders are already warmed up
 */
export function areShadersWarmedUp(compiler: ShaderCompiler): boolean {
  const stats = compiler.getCacheStats();
  // We expect at least 7 programs (one for each shader pass)
  return stats.programs >= 7;
}
