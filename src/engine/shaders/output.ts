/**
 * Output Shader
 * Final output transform: Linear RGB → sRGB with optional tone mapping
 */

import type { ShaderSource } from '../pipeline/ShaderRegistry';

export const outputVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

export const outputFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform bool u_enableToneMapping;
uniform int u_toneMappingMode; // 0 = reinhard, 1 = aces

// Linear RGB to sRGB conversion
vec3 linearToSrgb(vec3 linear) {
  vec3 srgb;
  for (int i = 0; i < 3; i++) {
    if (linear[i] <= 0.0031308) {
      srgb[i] = linear[i] * 12.92;
    } else {
      srgb[i] = 1.055 * pow(linear[i], 1.0/2.4) - 0.055;
    }
  }
  return srgb;
}

// Reinhard tone mapping
// Compresses highlights while preserving midtones
vec3 reinhardToneMap(vec3 color) {
  return color / (color + vec3(1.0));
}

// ACES filmic tone mapping (approximation)
// Professional film-like tone curve with shoulder and toe
vec3 acesToneMap(vec3 color) {
  // ACES coefficients (Hill 2020 approximation)
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  
  // Apply ACES curve
  vec3 mapped = (color * (a * color + b)) / (color * (c * color + d) + e);
  return clamp(mapped, 0.0, 1.0);
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  // Clamp to prevent NaN/Inf
  vec3 linear = clamp(color.rgb, 0.0, 65504.0);
  
  // Optional tone mapping
  if (u_enableToneMapping) {
    if (u_toneMappingMode == 0) {
      linear = reinhardToneMap(linear);
    } else {
      linear = acesToneMap(linear);
    }
  }
  
  // Convert to sRGB for display
  vec3 srgb = linearToSrgb(linear);
  
  fragColor = vec4(srgb, color.a);
}
`;

/**
 * Output shader parameters
 */
export interface OutputParams {
  enableToneMapping: boolean;
  toneMappingMode: 'reinhard' | 'aces';
}

/**
 * Apply output shader uniforms
 */
export function applyOutputUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: OutputParams
): void {
  const enableToneMappingLocation = uniforms.get('u_enableToneMapping');
  if (enableToneMappingLocation) {
    gl.uniform1i(enableToneMappingLocation, params.enableToneMapping ? 1 : 0);
  }

  const toneMappingModeLocation = uniforms.get('u_toneMappingMode');
  if (toneMappingModeLocation) {
    const mode = params.toneMappingMode === 'reinhard' ? 0 : 1;
    gl.uniform1i(toneMappingModeLocation, mode);
  }
}

// Legacy export for compatibility
export function createOutputShader(): ShaderSource {
  return { vertex: outputVertexShader, fragment: outputFragmentShader };
}
