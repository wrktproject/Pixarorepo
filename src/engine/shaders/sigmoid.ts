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
uniform int u_mode;           // 0 = per channel, 1 = RGB ratio (luminance-based)
uniform float u_huePreservation; // 0.0 to 1.0 (0 = per channel, 1 = preserve hue)
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
 * Calculate luminance for RGB ratio mode
 */
float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Apply sigmoid tone mapping per-channel
 * Per-channel processing preserves color ratios better than luminance-based
 */
vec3 applySigmoidPerChannel(vec3 rgb, float contrast, float skew, float middleGrey) {
  vec3 result;
  result.r = sigmoidCurve(rgb.r, contrast, skew, middleGrey);
  result.g = sigmoidCurve(rgb.g, contrast, skew, middleGrey);
  result.b = sigmoidCurve(rgb.b, contrast, skew, middleGrey);
  return result;
}

/**
 * Apply sigmoid tone mapping using RGB ratio method
 * Maps luminance through sigmoid curve, then preserves color ratios
 * Better for preserving hue but may desaturate
 */
vec3 applySigmoidRGBRatio(vec3 rgb, float contrast, float skew, float middleGrey) {
  // Calculate luminance
  float lum = getLuminance(rgb);
  
  // Apply sigmoid to luminance
  float mappedLum = sigmoidCurve(lum, contrast, skew, middleGrey);
  
  // Preserve color ratios
  float ratio = mappedLum / max(lum, EPSILON);
  return rgb * ratio;
}

/**
 * Apply sigmoid with hue preservation blending
 * Blends between per-channel and RGB ratio modes
 * 
 * @param rgb Input color
 * @param contrast Curve steepness
 * @param skew Curve shift
 * @param middleGrey Target middle grey
 * @param huePreservation 0.0 = per channel, 1.0 = preserve hue
 */
vec3 applySigmoidHuePreserve(vec3 rgb, float contrast, float skew, float middleGrey, float huePreservation) {
  vec3 perChannel = applySigmoidPerChannel(rgb, contrast, skew, middleGrey);
  vec3 rgbRatio = applySigmoidRGBRatio(rgb, contrast, skew, middleGrey);
  
  // Blend between modes based on hue preservation amount
  return mix(perChannel, rgbRatio, huePreservation);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate tone mapping
    color = srgbToLinear(color);
    
    // Apply sigmoid tone curve based on mode
    if (u_mode == 0) {
      // Per-channel mode (default)
      color = applySigmoidPerChannel(color, u_contrast, u_skew, u_middleGrey);
    } else if (u_mode == 1) {
      // RGB ratio mode (better hue preservation)
      color = applySigmoidRGBRatio(color, u_contrast, u_skew, u_middleGrey);
    }
    
    // Apply hue preservation blending if needed
    if (u_huePreservation > 0.0 && u_huePreservation < 1.0) {
      color = applySigmoidHuePreserve(color, u_contrast, u_skew, u_middleGrey, u_huePreservation);
    }
    
    // Clamp to valid range (allow HDR values for later processing)
    color = max(color, vec3(0.0));
    
    // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Sigmoid tone mapping mode
 */
export type SigmoidMode = 'per-channel' | 'rgb-ratio';

/**
 * Sigmoid tone mapping parameters
 */
export interface SigmoidParams {
  contrast: number;         // 0.5 to 2.0 (steepness of S-curve)
  skew: number;             // -1.0 to 1.0 (shift toward shadows or highlights)
  middleGrey: number;       // 0.1 to 0.3 (target middle grey, default 0.1845)
  mode: SigmoidMode;        // Processing mode: per-channel or rgb-ratio
  huePreservation: number;  // 0.0 to 1.0 (0 = per channel, 1 = preserve hue)
  enabled: boolean;         // Enable/disable sigmoid
}

/**
 * Default sigmoid parameters
 */
export const defaultSigmoidParams: SigmoidParams = {
  contrast: 1.0,
  skew: 0.0,
  middleGrey: 0.1845, // 18.45% grey (photographic standard)
  mode: 'per-channel',
  huePreservation: 0.0,
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

  const modeLocation = uniforms.get('u_mode');
  if (modeLocation) {
    const modeValue = params.mode === 'per-channel' ? 0 : 1;
    gl.uniform1i(modeLocation, modeValue);
  }

  const huePreservationLocation = uniforms.get('u_huePreservation');
  if (huePreservationLocation) {
    gl.uniform1f(huePreservationLocation, params.huePreservation);
  }

  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }
}
