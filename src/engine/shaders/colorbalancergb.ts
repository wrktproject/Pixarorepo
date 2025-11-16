/**
 * Color Balance RGB Shader
 * Implements per-zone color grading (shadows, midtones, highlights, global)
 * Uses DT UCS 2022 color space for perceptually uniform adjustments
 * Based on Darktable's Color Balance RGB module
 */

export const colorBalanceRGBVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const colorBalanceRGBFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enabled;

// Mask parameters
uniform float u_shadowsWeight;      // Falloff for shadows mask (0.5 to 3.0)
uniform float u_highlightsWeight;   // Falloff for highlights mask (0.5 to 3.0)
uniform float u_maskGreyFulcrum;    // Middle grey for mask (0.1 to 0.3, default 0.1845)

// Per-zone adjustments (shadows, midtones, highlights, global)
uniform vec3 u_shadowsAdjust;       // (luminance, chroma, hue)
uniform vec3 u_midtonesAdjust;      // (luminance, chroma, hue)
uniform vec3 u_highlightsAdjust;    // (luminance, chroma, hue)
uniform vec3 u_globalAdjust;        // (luminance, chroma, hue)

// Advanced controls
uniform float u_contrast;           // Global contrast (0.5 to 2.0)
uniform float u_contrastFulcrum;    // Pivot point for contrast (0.1 to 0.3)
uniform float u_vibrance;           // Adaptive saturation (-1.0 to 1.0)

out vec4 fragColor;

const float EPSILON = 1e-8;
const float PI = 3.14159265359;

// ============================================================================
// Color Space Conversions
// ============================================================================

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

// Calculate luminance using Rec. 709 coefficients
float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

// ============================================================================
// DT UCS 2022 Color Space (Simplified Implementation)
// ============================================================================

/**
 * Convert Linear RGB to DT UCS 2022 (JCH representation)
 * J: Lightness (perceptually uniform)
 * C: Chroma (colorfulness)
 * H: Hue angle (radians)
 * 
 * This is a simplified version optimized for real-time performance
 * Based on Darktable's implementation
 */
vec3 linearRGBToDTUCS(vec3 rgb) {
  // Clamp to prevent negative values
  rgb = max(rgb, vec3(0.0));
  
  // Calculate luminance
  float Y = getLuminance(rgb);
  
  // Perceptual lightness (similar to Lab L*)
  // Using a power function for perceptual uniformity
  float J = pow(Y + EPSILON, 0.42);
  
  // Calculate chroma components
  // Use opponent color space for perceptual uniformity
  float M = max(max(rgb.r, rgb.g), rgb.b);
  float m = min(min(rgb.r, rgb.g), rgb.b);
  float C_raw = M - m;
  
  // Normalize chroma by luminance to make it perceptually uniform
  float C = C_raw / (M + EPSILON);
  
  // Calculate hue angle
  float H = 0.0;
  if (C_raw > EPSILON) {
    // Compute hue in opponent color space
    float r_g = rgb.r - rgb.g;
    float g_b = rgb.g - rgb.b;
    float b_r = rgb.b - rgb.r;
    
    // Use atan2 for proper quadrant handling
    H = atan(g_b, r_g);
  }
  
  return vec3(J, C, H);
}

/**
 * Convert DT UCS (JCH) back to Linear RGB
 */
vec3 dtucsToLinearRGB(vec3 jch) {
  float J = jch.x;
  float C = jch.y;
  float H = jch.z;
  
  // Recover luminance from perceptual lightness
  float Y = pow(max(J, 0.0), 1.0 / 0.42);
  
  // Reconstruct RGB from hue and chroma
  // This is an approximation for real-time performance
  float r_g = cos(H);
  float g_b = sin(H);
  
  // Reconstruct opponent color components
  float r = Y + C * r_g * 0.5;
  float g = Y - C * (r_g - g_b) * 0.25;
  float b = Y - C * g_b * 0.5;
  
  // Normalize to maintain luminance
  vec3 rgb = vec3(r, g, b);
  float currentY = getLuminance(rgb);
  if (currentY > EPSILON) {
    rgb *= Y / currentY;
  }
  
  return max(rgb, vec3(0.0));
}

// ============================================================================
// Luminance Mask Generation
// ============================================================================

/**
 * Generate luminance-based masks for shadows, midtones, and highlights
 * 
 * @param Y Luminance value (0 to 1)
 * @param grey Grey fulcrum point (default 0.1845 for 18.45% grey)
 * @param shadowsWeight Falloff for shadows mask (higher = sharper transition)
 * @param highlightsWeight Falloff for highlights mask (higher = sharper transition)
 * @return vec3(shadows, midtones, highlights) masks
 */
vec3 generateLuminanceMasks(float Y, float grey, float shadowsWeight, float highlightsWeight) {
  // Clamp luminance to valid range
  Y = clamp(Y, 0.0, 1.0);
  
  // Shadows mask: 1.0 at black, 0.0 at grey
  // Uses power function for smooth falloff
  float shadows = pow(clamp(1.0 - Y / grey, 0.0, 1.0), shadowsWeight);
  
  // Highlights mask: 0.0 at grey, 1.0 at white
  // Uses power function for smooth falloff
  float highlights = pow(clamp((Y - grey) / (1.0 - grey), 0.0, 1.0), highlightsWeight);
  
  // Midtones mask: peak at grey, falls off toward black and white
  // Ensures masks sum to approximately 1.0
  float midtones = 1.0 - shadows - highlights;
  midtones = max(midtones, 0.0);
  
  return vec3(shadows, midtones, highlights);
}

// ============================================================================
// Color Adjustments
// ============================================================================

/**
 * Apply color adjustment in DT UCS space
 * 
 * @param jch Color in DT UCS (J, C, H)
 * @param adjust Adjustment vector (luminance, chroma, hue)
 * @return Adjusted color in DT UCS
 */
vec3 applyColorAdjustment(vec3 jch, vec3 adjust) {
  // Apply luminance shift
  jch.x += adjust.x;
  
  // Apply chroma shift (multiplicative for perceptual uniformity)
  jch.y *= (1.0 + adjust.y);
  
  // Apply hue shift (additive in radians)
  jch.z += adjust.z;
  
  // Clamp to valid ranges
  jch.x = max(jch.x, 0.0);
  jch.y = max(jch.y, 0.0);
  
  return jch;
}

/**
 * Apply contrast adjustment with adjustable fulcrum
 * 
 * @param J Lightness value
 * @param contrast Contrast multiplier (0.5 to 2.0)
 * @param fulcrum Pivot point for contrast (0.1 to 0.3)
 * @return Adjusted lightness
 */
float applyContrast(float J, float contrast, float fulcrum) {
  // Apply contrast around fulcrum point
  float centered = J - fulcrum;
  float adjusted = centered * contrast + fulcrum;
  return adjusted;
}

/**
 * Apply vibrance (adaptive saturation)
 * Enhances muted colors more than saturated colors
 * 
 * @param C Chroma value
 * @param vibrance Vibrance amount (-1.0 to 1.0)
 * @return Adjusted chroma
 */
float applyVibrance(float C, float vibrance) {
  // Adaptive saturation weight: enhance muted colors more
  float satWeight = 1.0 - pow(clamp(C, 0.0, 1.0), 0.5);
  
  // Apply vibrance with adaptive weight
  float newC = C * (1.0 + vibrance * satWeight);
  
  return max(newC, 0.0);
}

// ============================================================================
// Main Color Balance RGB Processing
// ============================================================================

vec3 applyColorBalanceRGB(vec3 rgb) {
  // Convert to linear space
  rgb = srgbToLinear(rgb);
  
  // Convert to DT UCS for perceptually uniform adjustments
  vec3 jch = linearRGBToDTUCS(rgb);
  
  // Get luminance for mask generation
  float Y = getLuminance(rgb);
  
  // Generate luminance masks
  vec3 masks = generateLuminanceMasks(Y, u_maskGreyFulcrum, u_shadowsWeight, u_highlightsWeight);
  
  // Apply per-zone adjustments
  vec3 shadowsJCH = applyColorAdjustment(jch, u_shadowsAdjust);
  vec3 midtonesJCH = applyColorAdjustment(jch, u_midtonesAdjust);
  vec3 highlightsJCH = applyColorAdjustment(jch, u_highlightsAdjust);
  
  // Blend adjustments using masks
  jch = shadowsJCH * masks.x + midtonesJCH * masks.y + highlightsJCH * masks.z;
  
  // Apply global adjustments
  jch = applyColorAdjustment(jch, u_globalAdjust);
  
  // Apply contrast
  jch.x = applyContrast(jch.x, u_contrast, u_contrastFulcrum);
  
  // Apply vibrance
  jch.y = applyVibrance(jch.y, u_vibrance);
  
  // Convert back to linear RGB
  rgb = dtucsToLinearRGB(jch);
  
  // Clamp to valid range (allow HDR values for later processing)
  rgb = max(rgb, vec3(0.0));
  
  // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  return rgb;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    color = applyColorBalanceRGB(color);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Color Balance RGB parameters
 */
export interface ColorBalanceZoneAdjustment {
  luminance: number;  // -1.0 to 1.0
  chroma: number;     // -1.0 to 1.0
  hue: number;        // -PI to PI (radians)
}

export interface ColorBalanceRGBParams {
  enabled: boolean;
  
  // Per-zone adjustments
  shadows: ColorBalanceZoneAdjustment;
  midtones: ColorBalanceZoneAdjustment;
  highlights: ColorBalanceZoneAdjustment;
  global: ColorBalanceZoneAdjustment;
  
  // Mask controls
  shadowsWeight: number;      // 0.5 to 3.0 (falloff)
  highlightsWeight: number;   // 0.5 to 3.0 (falloff)
  maskGreyFulcrum: number;    // 0.1 to 0.3 (default 0.1845)
  
  // Advanced controls
  contrast: number;           // 0.5 to 2.0
  contrastFulcrum: number;    // 0.1 to 0.3
  vibrance: number;           // -1.0 to 1.0
}

/**
 * Default Color Balance RGB parameters
 */
export const defaultColorBalanceRGBParams: ColorBalanceRGBParams = {
  enabled: false,
  
  shadows: {
    luminance: 0.0,
    chroma: 0.0,
    hue: 0.0,
  },
  midtones: {
    luminance: 0.0,
    chroma: 0.0,
    hue: 0.0,
  },
  highlights: {
    luminance: 0.0,
    chroma: 0.0,
    hue: 0.0,
  },
  global: {
    luminance: 0.0,
    chroma: 0.0,
    hue: 0.0,
  },
  
  shadowsWeight: 1.0,
  highlightsWeight: 1.0,
  maskGreyFulcrum: 0.1845, // 18.45% grey (photographic standard)
  
  contrast: 1.0,
  contrastFulcrum: 0.1845,
  vibrance: 0.0,
};

/**
 * Apply Color Balance RGB uniforms to shader program
 */
export function applyColorBalanceRGBUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: ColorBalanceRGBParams
): void {
  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }

  // Mask parameters
  const shadowsWeightLocation = uniforms.get('u_shadowsWeight');
  if (shadowsWeightLocation) {
    gl.uniform1f(shadowsWeightLocation, params.shadowsWeight);
  }

  const highlightsWeightLocation = uniforms.get('u_highlightsWeight');
  if (highlightsWeightLocation) {
    gl.uniform1f(highlightsWeightLocation, params.highlightsWeight);
  }

  const maskGreyFulcrumLocation = uniforms.get('u_maskGreyFulcrum');
  if (maskGreyFulcrumLocation) {
    gl.uniform1f(maskGreyFulcrumLocation, params.maskGreyFulcrum);
  }

  // Per-zone adjustments
  const shadowsAdjustLocation = uniforms.get('u_shadowsAdjust');
  if (shadowsAdjustLocation) {
    gl.uniform3f(
      shadowsAdjustLocation,
      params.shadows.luminance,
      params.shadows.chroma,
      params.shadows.hue
    );
  }

  const midtonesAdjustLocation = uniforms.get('u_midtonesAdjust');
  if (midtonesAdjustLocation) {
    gl.uniform3f(
      midtonesAdjustLocation,
      params.midtones.luminance,
      params.midtones.chroma,
      params.midtones.hue
    );
  }

  const highlightsAdjustLocation = uniforms.get('u_highlightsAdjust');
  if (highlightsAdjustLocation) {
    gl.uniform3f(
      highlightsAdjustLocation,
      params.highlights.luminance,
      params.highlights.chroma,
      params.highlights.hue
    );
  }

  const globalAdjustLocation = uniforms.get('u_globalAdjust');
  if (globalAdjustLocation) {
    gl.uniform3f(
      globalAdjustLocation,
      params.global.luminance,
      params.global.chroma,
      params.global.hue
    );
  }

  // Advanced controls
  const contrastLocation = uniforms.get('u_contrast');
  if (contrastLocation) {
    gl.uniform1f(contrastLocation, params.contrast);
  }

  const contrastFulcrumLocation = uniforms.get('u_contrastFulcrum');
  if (contrastFulcrumLocation) {
    gl.uniform1f(contrastFulcrumLocation, params.contrastFulcrum);
  }

  const vibranceLocation = uniforms.get('u_vibrance');
  if (vibranceLocation) {
    gl.uniform1f(vibranceLocation, params.vibrance);
  }
}
