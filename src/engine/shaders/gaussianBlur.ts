/**
 * Gaussian Blur Shader
 * Implements separable 9-tap Gaussian blur for multi-pass effects
 * Used for clarity, sharpening, and other detail adjustments
 */

export const gaussianBlurVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const gaussianBlurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_direction;      // (1,0) for horizontal, (0,1) for vertical
uniform float u_radius;        // Blur radius in pixels (default: 1.0)

out vec4 fragColor;

// 9-tap Gaussian kernel weights
// Sigma = 1.0, normalized
const float weights[5] = float[](
  0.227027,   // Center
  0.1945946,  // +/- 1
  0.1216216,  // +/- 2
  0.054054,   // +/- 3
  0.016216    // +/- 4
);

void main() {
  // Get texture size for calculating texel size
  vec2 texSize = vec2(textureSize(u_texture, 0));
  vec2 texelSize = 1.0 / texSize;
  
  // Calculate offset direction scaled by radius
  vec2 offset = u_direction * texelSize * u_radius;
  
  // Sample center pixel with center weight
  vec3 result = texture(u_texture, v_texCoord).rgb * weights[0];
  
  // Sample surrounding pixels in both directions
  for (int i = 1; i < 5; i++) {
    vec2 offsetAmount = offset * float(i);
    
    // Sample in positive direction
    result += texture(u_texture, v_texCoord + offsetAmount).rgb * weights[i];
    
    // Sample in negative direction
    result += texture(u_texture, v_texCoord - offsetAmount).rgb * weights[i];
  }
  
  fragColor = vec4(result, 1.0);
}
`;

/**
 * Gaussian blur parameters
 */
export interface GaussianBlurParams {
  direction: [number, number]; // [1, 0] for horizontal, [0, 1] for vertical
  radius: number;               // Blur radius in pixels
}

/**
 * Apply Gaussian blur uniforms to shader program
 */
export function applyGaussianBlurUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: GaussianBlurParams
): void {
  const directionLocation = uniforms.get('u_direction');
  if (directionLocation) {
    gl.uniform2f(directionLocation, params.direction[0], params.direction[1]);
  }

  const radiusLocation = uniforms.get('u_radius');
  if (radiusLocation) {
    gl.uniform1f(radiusLocation, params.radius);
  }
}

/**
 * Helper to create horizontal blur parameters
 */
export function createHorizontalBlurParams(radius: number = 1.0): GaussianBlurParams {
  return {
    direction: [1, 0],
    radius,
  };
}

/**
 * Helper to create vertical blur parameters
 */
export function createVerticalBlurParams(radius: number = 1.0): GaussianBlurParams {
  return {
    direction: [0, 1],
    radius,
  };
}
