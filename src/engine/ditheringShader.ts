/**
 * Dithering Shader
 * Applies ordered dithering when converting from float to 8-bit
 * Requirement 14.3: Add dithering when converting to 8-bit
 */

/**
 * Vertex shader for dithering pass
 */
export const ditheringVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Fragment shader for dithering pass
 * Uses Bayer matrix for ordered dithering
 */
export const ditheringFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_ditherStrength; // 0.0 to 1.0

// 8x8 Bayer matrix for ordered dithering
const mat4 bayerMatrix0 = mat4(
   0.0, 32.0,  8.0, 40.0,
  48.0, 16.0, 56.0, 24.0,
  12.0, 44.0,  4.0, 36.0,
  60.0, 28.0, 52.0, 20.0
);

const mat4 bayerMatrix1 = mat4(
   3.0, 35.0, 11.0, 43.0,
  51.0, 19.0, 59.0, 27.0,
  15.0, 47.0,  7.0, 39.0,
  63.0, 31.0, 55.0, 23.0
);

float getBayerValue(ivec2 pos) {
  int x = pos.x % 8;
  int y = pos.y % 8;
  
  if (y < 4) {
    if (x < 4) {
      return bayerMatrix0[y][x];
    } else {
      return bayerMatrix1[y][x - 4];
    }
  } else {
    if (x < 4) {
      return bayerMatrix0[y - 4][x];
    } else {
      return bayerMatrix1[y - 4][x - 4];
    }
  }
}

void main() {
  vec4 color = texture(u_texture, v_texCoord);
  
  // Apply dithering if strength > 0
  if (u_ditherStrength > 0.0) {
    ivec2 pixelPos = ivec2(v_texCoord * u_resolution);
    float bayerValue = getBayerValue(pixelPos);
    
    // Normalize Bayer value to -0.5 to 0.5 range
    float ditherValue = (bayerValue / 64.0 - 0.5) * u_ditherStrength;
    
    // Scale dither amount based on bit depth reduction (16-bit float to 8-bit)
    // 1/255 is the quantization step for 8-bit
    float ditherAmount = ditherValue / 255.0;
    
    // Apply dither to each channel
    color.rgb += ditherAmount;
  }
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = color;
}
`;

/**
 * Apply dithering uniforms
 */
export function applyDitheringUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  config: {
    resolution: { width: number; height: number };
    ditherStrength: number;
  }
): void {
  const resolutionLoc = uniforms.get('u_resolution');
  if (resolutionLoc) {
    gl.uniform2f(resolutionLoc, config.resolution.width, config.resolution.height);
  }

  const strengthLoc = uniforms.get('u_ditherStrength');
  if (strengthLoc) {
    gl.uniform1f(strengthLoc, config.ditherStrength);
  }
}
