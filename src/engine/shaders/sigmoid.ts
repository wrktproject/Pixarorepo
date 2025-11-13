/**
 * Sigmoid Tone Mapping Shader
 * Implements generalized logistic function for S-curve tone compression
 * Based on Darktable's sigmoid module for excellent color preservation
 */

export const sigmoidVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const sigmoidFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_contrast;     // 0.5 to 2.0 (steepness of S-curve)
uniform float u_skew;         // -1.0 to 1.0 (shift toward shadows or highlights)
uniform float u_middleGrey;   // 0.1 to 0.3 (target middle grey, default 0.1845)
uniform bool u_enabled;       // Enable/disable sigmoid

out vec4 fragColor;

// Accurate sRGB to Linear conversion
vec3 srgbToLinear(vec3 srgb) {
  vec3 linear;
  for (int i = 0; i < 3; i++) {
    if (srgb[i] <= 0.04045) {
      linear[i] = srgb[i] / 12.92;
    } else {
      linear[i] = pow((srgb[i] + 0.055) / 1.055, 2.4);
    }
  }
  return linear;
}

// Accurate Linear to sRGB conversion
vec3 linearToSrgb(vec3 linear) {
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

/**
 * Generalized logistic function (sigmoid curve)
 * 
 * @param x Input value (linear RGB channel)
 * @param contrast Steepness of the curve (higher = more contrast)
 * @param skew Shifts the inflection point (negative = favor shadows, positive = favor highlights)
 * @param middleGrey Target middle grey value
 * @return Tone-mapped value
 */
float sigmoidCurve(float x, float contrast, float skew, float middleGrey) {
  // Prevent division by zero and handle edge cases
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  
  // Calculate inflection point based on skew
  // skew = 0: inflection at 0.5
  // skew < 0: inflection shifts left (favor shadows)
  // skew > 0: inflection shifts right (favor highlights)
  float x0 = 0.5 + skew * 0.3;
  
  // Calculate steepness parameter
  // Higher contrast = steeper curve
  float k = contrast * 10.0;
  
  // Normalize input around middle grey
  // This ensures the curve pivots around the photographic middle grey
  float normalized = x / middleGrey;
  
  // Apply generalized logistic function
  // f(x) = 1 / (1 + exp(-k * (x - x0)))
  float sigmoid = 1.0 / (1.0 + exp(-k * (normalized - x0)));
  
  // Scale back to middle grey
  return sigmoid * middleGrey;
}

/**
 * Apply sigmoid tone mapping per-channel
 * Per-channel processing preserves color ratios better than luminance-based
 */
vec3 applySigmoid(vec3 rgb, float contrast, float skew, float middleGrey) {
  vec3 result;
  result.r = sigmoidCurve(rgb.r, contrast, skew, middleGrey);
  result.g = sigmoidCurve(rgb.g, contrast, skew, middleGrey);
  result.b = sigmoidCurve(rgb.b, contrast, skew, middleGrey);
  return result;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate tone mapping
    color = srgbToLinear(color);
    
    // Apply sigmoid tone curve per-channel
    color = applySigmoid(color, u_contrast, u_skew, u_middleGrey);
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    // Convert back to sRGB for display
    color = linearToSrgb(color);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Sigmoid tone mapping parameters
 */
export interface SigmoidParams {
  contrast: number;    // 0.5 to 2.0 (steepness of S-curve)
  skew: number;        // -1.0 to 1.0 (shift toward shadows or highlights)
  middleGrey: number;  // 0.1 to 0.3 (target middle grey, default 0.1845)
  enabled: boolean;    // Enable/disable sigmoid
}

/**
 * Default sigmoid parameters
 */
export const defaultSigmoidParams: SigmoidParams = {
  contrast: 1.0,
  skew: 0.0,
  middleGrey: 0.1845, // 18.45% grey (photographic standard)
  enabled: false,
};

/**
 * Apply sigmoid adjustment uniforms to shader program
 */
export function applySigmoidUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: SigmoidParams
): void {
  const contrastLocation = uniforms.get('u_contrast');
  if (contrastLocation) {
    gl.uniform1f(contrastLocation, params.contrast);
  }

  const skewLocation = uniforms.get('u_skew');
  if (skewLocation) {
    gl.uniform1f(skewLocation, params.skew);
  }

  const middleGreyLocation = uniforms.get('u_middleGrey');
  if (middleGreyLocation) {
    gl.uniform1f(middleGreyLocation, params.middleGrey);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}
