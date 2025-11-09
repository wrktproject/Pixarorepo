/**
 * Clarity Composite Shader
 * Implements two-pass clarity effect using Gaussian blur
 * Creates high-pass filter by subtracting blurred image from original
 * and composites back with user-controlled intensity
 */

export const clarityCompositeVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const clarityCompositeFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_original;  // Original image
uniform sampler2D u_blurred;   // Blurred image (from Gaussian blur passes)
uniform float u_clarity;       // -100.0 to +100.0

out vec4 fragColor;

void main() {
  vec3 original = texture(u_original, v_texCoord).rgb;
  vec3 blurred = texture(u_blurred, v_texCoord).rgb;
  
  // High-pass filter: original - blurred
  // This extracts the detail/edges from the image
  vec3 highpass = original - blurred;
  
  // Normalize clarity amount to -1.0 to +1.0 range
  float strength = u_clarity / 100.0;
  
  // Add high-pass back with user-controlled amount
  // Positive clarity enhances detail, negative reduces it
  vec3 result = original + highpass * strength;
  
  // Clamp to valid range to prevent artifacts
  result = clamp(result, 0.0, 1.0);
  
  fragColor = vec4(result, 1.0);
}
`;

/**
 * Clarity composite parameters
 */
export interface ClarityCompositeParams {
  clarity: number; // -100.0 to +100.0
}

/**
 * Apply clarity composite uniforms to shader program
 */
export function applyClarityCompositeUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: ClarityCompositeParams
): void {
  const clarityLocation = uniforms.get('u_clarity');
  if (clarityLocation) {
    gl.uniform1f(clarityLocation, params.clarity);
  }
}
