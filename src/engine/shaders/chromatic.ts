/**
 * Chromatic Aberration Correction Shader
 * Corrects lateral chromatic aberration (color fringing at edges)
 * Common in wide-angle lenses and lower-quality optics
 */

export const chromaticVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const chromaticFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_strength;  // Correction strength (-1.0 to 1.0)
uniform bool u_enabled;    // Enable/disable correction

out vec4 fragColor;

const float EPSILON = 1e-8;

/**
 * Correct lateral chromatic aberration
 * Shifts red and blue channels radially from center
 * 
 * @param uv Texture coordinates
 * @param strength Correction strength (positive = expand edges, negative = contract)
 * @return Color with corrected chromatic aberration
 */
vec3 correctChromaticAberration(vec2 uv, float strength) {
  // Center point
  vec2 center = vec2(0.5, 0.5);
  
  // Vector from center to current position
  vec2 toCenter = uv - center;
  float dist = length(toCenter);
  
  // Scale strength by distance from center (stronger effect at edges)
  // This matches how real lenses exhibit CA (worse at edges)
  float distScale = dist * 2.0; // Normalize to 0-1 range at corners
  float localStrength = strength * distScale;
  
  // Calculate radial offset for each channel
  // Red shifts outward, blue shifts inward (typical CA pattern)
  vec2 offset = toCenter * localStrength * 0.003;
  
  // Sample each channel with appropriate offset
  float r = texture(u_texture, uv + offset).r;      // Red shifts outward
  float g = texture(u_texture, uv).g;               // Green stays centered
  float b = texture(u_texture, uv - offset).b;      // Blue shifts inward
  
  return vec3(r, g, b);
}

/**
 * Advanced chromatic aberration correction with quadratic falloff
 * More accurate modeling of real lens behavior
 */
vec3 correctChromaticAberrationAdvanced(vec2 uv, float strength) {
  vec2 center = vec2(0.5, 0.5);
  vec2 toCenter = uv - center;
  float dist = length(toCenter);
  
  // Quadratic falloff (more realistic for real lenses)
  float distScale = dist * dist * 4.0;
  float localStrength = strength * distScale;
  
  // Normalized direction vector
  vec2 dir = toCenter / max(dist, EPSILON);
  vec2 offset = dir * localStrength * 0.003;
  
  // Sample with higher quality (use 3 samples per channel for smoother result)
  vec3 result = vec3(0.0);
  
  // Red channel (outward shift)
  result.r = texture(u_texture, uv + offset).r;
  
  // Green channel (centered)
  result.g = texture(u_texture, uv).g;
  
  // Blue channel (inward shift)
  result.b = texture(u_texture, uv - offset).b;
  
  return result;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled && abs(u_strength) > 0.001) {
    // Use advanced correction for better quality
    color = correctChromaticAberrationAdvanced(v_texCoord, u_strength);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Chromatic aberration correction parameters
 */
export interface ChromaticParams {
  strength: number; // Correction strength (-1.0 to 1.0)
  enabled: boolean; // Enable/disable correction
}

/**
 * Default chromatic aberration parameters
 */
export const defaultChromaticParams: ChromaticParams = {
  strength: 0.0,
  enabled: false,
};

/**
 * Apply chromatic aberration correction uniforms to shader program
 */
export function applyChromaticUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: ChromaticParams
): void {
  const strengthLocation = uniforms.get('u_strength');
  if (strengthLocation) {
    gl.uniform1f(strengthLocation, params.strength);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}

