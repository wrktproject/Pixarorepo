/**
 * Tonal Adjustment Shader
 * Handles exposure, contrast, highlights, shadows, whites, blacks
 */

export const tonalVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const tonalFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform float u_exposure;      // -5.0 to +5.0 stops
uniform float u_contrast;      // -100.0 to +100.0
uniform float u_highlights;    // -100.0 to +100.0
uniform float u_shadows;       // -100.0 to +100.0
uniform float u_whites;        // -100.0 to +100.0
uniform float u_blacks;        // -100.0 to +100.0

out vec4 fragColor;

// Accurate sRGB to Linear conversion (Lightroom-quality)
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

// Luminance (Rec. 709)
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// ============================================================================
// Professional Soft-Knee Curves (Darktable-inspired)
// ============================================================================

// Soft knee function for smooth transitions
// Uses a combination of sigmoid and power functions for film-like response
float softKnee(float x, float threshold, float width) {
  // Normalized distance from threshold
  float d = (x - threshold) / max(width, 0.001);
  
  // Soft sigmoid for smooth transition (no hard edges)
  return 1.0 / (1.0 + exp(-4.0 * d));
}

// Enhanced highlight mask with soft rolloff
// Provides film-like highlight compression without harsh clipping
float highlightMask(float lum) {
  // Start affecting at 0.5, full effect at 0.9
  // Uses soft knee for natural rolloff
  float mask = softKnee(lum, 0.5, 0.25);
  
  // Additional boost for very bright areas (soft clipping zone)
  float brightBoost = smoothstep(0.7, 1.0, lum);
  
  return mix(mask, 1.0, brightBoost * 0.3);
}

// Enhanced shadow mask with soft lift
// Preserves shadow detail while allowing luminance adjustments
float shadowMask(float lum) {
  // Full effect below 0.2, fading to 0.5
  // Inverted soft knee for shadow region
  float mask = 1.0 - softKnee(lum, 0.35, 0.25);
  
  // Protect deep blacks from complete crushing
  float deepShadowProtect = 1.0 - smoothstep(0.0, 0.05, lum);
  
  return mix(mask, mask * 0.7, deepShadowProtect);
}

// White point mask - affects brightest values
float whiteMask(float lum) {
  // Soft knee starting at 0.75, full effect at 1.0
  return softKnee(lum, 0.75, 0.15);
}

// Black point mask - affects darkest values  
float blackMask(float lum) {
  // Inverted soft knee, affects values below 0.25
  return 1.0 - softKnee(lum, 0.15, 0.12);
}

// Apply exposure (photographic stops: +1 = double brightness)
vec3 applyExposure(vec3 color, float exposure) {
  return color * pow(2.0, exposure);
}

// Apply contrast (Darktable/Lightroom-style)
// Uses power function around 18% grey fulcrum for photographic accuracy
vec3 applyContrast(vec3 color, float contrast) {
  // Grey fulcrum at 18% (photographic middle grey in linear space)
  // This matches Darktable's approach for perceptually correct contrast
  const float grey_fulcrum = 0.1845;
  
  // Convert -100..+100 to a more subtle range
  // Reduce intensity by 50% for more gradual adjustments
  // FIXED: Negate to match Lightroom behavior (right = more contrast)
  float normalized = -(contrast / 100.0) * 0.5; // +0.5 to -0.5 (inverted)
  
  // Calculate gamma: smaller gamma = more contrast
  // At 0: gamma = 1.0 (no change)
  // At +100: gamma = 0.67 (MORE contrast - correct!)
  // At -100: gamma = 1.5 (LESS contrast - correct!)
  float gamma = 1.0 / (1.0 + normalized);
  
  // Apply power function around grey fulcrum
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (color[i] <= 0.0001) {
      result[i] = 0.0;
    } else {
      // Power function: (color / fulcrum)^gamma * fulcrum
      result[i] = pow(color[i] / grey_fulcrum, gamma) * grey_fulcrum;
    }
  }
  
  return result;
}

// Apply highlights with soft-knee rolloff (film-like highlight recovery)
// Negative values compress highlights, positive values expand/brighten
vec3 applyHighlights(vec3 color, float highlights) {
  float lum = getLuminance(color);
  float mask = highlightMask(lum);
  
  // Scale adjustment with soft compression curve
  float adjustment = highlights / 100.0;
  
  // For highlight recovery (negative), use soft compression
  // For highlight boost (positive), use soft expansion
  float factor;
  if (adjustment < 0.0) {
    // Compress: darker highlights, soft rolloff to prevent clipping
    // Uses a gentle power curve for natural look
    factor = 1.0 + adjustment * mask * 0.6;
    factor = max(factor, 0.2); // Prevent complete black-out
  } else {
    // Expand: brighter highlights with soft knee to prevent blowout
    factor = 1.0 + adjustment * mask * 0.8;
  }
  
  return color * factor;
}

// Apply shadows with soft lift (preserve detail in dark areas)
// Negative values crush shadows, positive values lift/brighten
vec3 applyShadows(vec3 color, float shadows) {
  float lum = getLuminance(color);
  float mask = shadowMask(lum);
  
  float adjustment = shadows / 100.0;
  
  // For shadow lift (positive), add luminance to shadows
  // For shadow crush (negative), reduce shadow luminance
  float factor;
  if (adjustment > 0.0) {
    // Lift shadows: use a soft curve that preserves deep shadows
    // The adjustment is additive for very dark areas
    float additive = adjustment * mask * 0.15;
    factor = 1.0 + adjustment * mask * 0.7;
    color = color * factor + vec3(additive * mask);
    return max(color, vec3(0.0));
  } else {
    // Crush shadows: reduce shadow luminance
    factor = 1.0 + adjustment * mask * 0.5;
    factor = max(factor, 0.1);
  }
  
  return color * factor;
}

// Apply whites (affects brightest 25% of image)
// Adjusts the white point - where highlights clip
vec3 applyWhites(vec3 color, float whites) {
  float lum = getLuminance(color);
  float mask = whiteMask(lum);
  
  float adjustment = (whites / 100.0) * 0.6;
  float factor = 1.0 + adjustment * mask;
  
  // Prevent complete clipping
  factor = clamp(factor, 0.3, 2.5);
  
  return color * factor;
}

// Apply blacks (affects darkest 25% of image)
// Adjusts the black point - where shadows clip
vec3 applyBlacks(vec3 color, float blacks) {
  float lum = getLuminance(color);
  float mask = blackMask(lum);
  
  float adjustment = blacks / 100.0;
  
  // For black lift (positive), add a bit of light to darkest areas
  // For black crush (negative), push blacks toward zero
  if (adjustment > 0.0) {
    // Lift blacks: add luminance to very dark areas
    float lift = adjustment * mask * 0.08;
    color = color + vec3(lift);
  } else {
    // Crush blacks: multiply down the darkest areas
    float crush = 1.0 + adjustment * mask * 0.7;
    crush = max(crush, 0.0);
    color = color * crush;
  }
  
  return max(color, vec3(0.0));
}

void main() {
  // Sample texture
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Convert to linear color space for accurate color math
  color = srgbToLinear(color);
  
  // 1. EXPOSURE (photographic stops in linear space)
  color = applyExposure(color, u_exposure);
  
  // 2. HIGHLIGHTS & SHADOWS (luminance-based, order matters)
  color = applyHighlights(color, u_highlights);
  color = applyShadows(color, u_shadows);
  
  // 3. WHITES & BLACKS (extreme tones)
  color = applyWhites(color, u_whites);
  color = applyBlacks(color, u_blacks);
  
  // 4. CONTRAST (around midpoint, applied last)
  color = applyContrast(color, u_contrast);
  
  // Clamp to valid range (but allow HDR values for filmic/sigmoid tone mapping later)
  color = max(color, vec3(0.0));
  
  // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  // This prevents double gamma correction which causes washed out colors
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Tonal adjustment parameters
 */
export interface TonalAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
}

/**
 * Apply tonal adjustment uniforms to shader program
 */
export function applyTonalUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: TonalAdjustments
): void {
  const exposureLocation = uniforms.get('u_exposure');
  if (exposureLocation) {
    gl.uniform1f(exposureLocation, adjustments.exposure);
  }

  const contrastLocation = uniforms.get('u_contrast');
  if (contrastLocation) {
    gl.uniform1f(contrastLocation, adjustments.contrast);
  }

  const highlightsLocation = uniforms.get('u_highlights');
  if (highlightsLocation) {
    gl.uniform1f(highlightsLocation, adjustments.highlights);
  }

  const shadowsLocation = uniforms.get('u_shadows');
  if (shadowsLocation) {
    gl.uniform1f(shadowsLocation, adjustments.shadows);
  }

  const whitesLocation = uniforms.get('u_whites');
  if (whitesLocation) {
    gl.uniform1f(whitesLocation, adjustments.whites);
  }

  const blacksLocation = uniforms.get('u_blacks');
  if (blacksLocation) {
    gl.uniform1f(blacksLocation, adjustments.blacks);
  }
}
