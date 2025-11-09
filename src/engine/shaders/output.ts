/**
 * Output Shader with Tone Mapping
 * Handles tone mapping for HDR content and final linear to sRGB conversion
 */

export const outputVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const outputFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enableToneMapping;
uniform int u_toneMappingMode; // 0 = Reinhard, 1 = ACES

out vec4 fragColor;

// Accurate Linear to sRGB conversion
vec3 linearToSRGB(vec3 linear) {
  vec3 srgb;
  for (int i = 0; i < 3; i++) {
    if (linear[i] <= 0.0031308) {
      srgb[i] = linear[i] * 12.92;
    } else {
      srgb[i] = 1.055 * pow(linear[i], 1.0 / 2.4) - 0.055;
    }
  }
  return srgb;
}

// Reinhard tone mapping
// Simple and effective for HDR content
// Maps infinite range to [0, 1]
vec3 reinhardToneMap(vec3 color) {
  return color / (color + vec3(1.0));
}

// ACES Filmic tone mapping
// Higher quality, cinema-grade tone mapping
// Provides better color preservation and smoother highlights
vec3 acesToneMap(vec3 color) {
  // ACES approximation by Krzysztof Narkowicz
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  
  vec3 mapped = (color * (a * color + b)) / (color * (c * color + d) + e);
  return clamp(mapped, 0.0, 1.0);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Apply tone mapping if enabled (for HDR content)
  if (u_enableToneMapping) {
    if (u_toneMappingMode == 1) {
      // ACES filmic tone mapping
      color = acesToneMap(color);
    } else {
      // Reinhard tone mapping (default)
      color = reinhardToneMap(color);
    }
  }
  
  // Clamp before gamma correction to ensure valid range
  color = clamp(color, 0.0, 1.0);
  
  // Convert from linear RGB to sRGB for display
  color = linearToSRGB(color);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Output shader parameters
 */
export interface OutputSettings {
  enableToneMapping: boolean;
  toneMappingMode: 'reinhard' | 'aces';
}

/**
 * Apply output shader uniforms to shader program
 */
export function applyOutputUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  settings: OutputSettings
): void {
  const enableToneMappingLocation = uniforms.get('u_enableToneMapping');
  if (enableToneMappingLocation) {
    gl.uniform1i(enableToneMappingLocation, settings.enableToneMapping ? 1 : 0);
  }

  const toneMappingModeLocation = uniforms.get('u_toneMappingMode');
  if (toneMappingModeLocation) {
    const mode = settings.toneMappingMode === 'aces' ? 1 : 0;
    gl.uniform1i(toneMappingModeLocation, mode);
  }
}
