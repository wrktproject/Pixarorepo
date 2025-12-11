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
// Professional Smooth Curves (Lightroom-style, Darktable-accurate)
// ============================================================================

// Smooth step function using smooth Hermite interpolation
// More gradual and film-like than the sharp version
float smoothStep3(float t) {
  // Smoothstep formula: t^2 * (3 - 2*t) for smooth acceleration/deceleration
  return t * t * (3.0 - 2.0 * t);
}

// Enhanced highlight mask with Lightroom-style rolloff
// Creates smooth, non-clipping highlight recovery that's perceptually accurate
float highlightMask(float lum) {
  // Highlights primarily affect luminance > 0.5
  // But start transitioning around 0.4 for smooth blending
  // Uses a smooth curve that peaks at luminance 1.0
  
  // Start the effect at 0.4, full effect by 0.7
  float transitionStart = 0.4;
  float fullEffectStart = 0.7;
  
  if (lum < transitionStart) {
    return 0.0;
  } else if (lum >= fullEffectStart) {
    return 1.0;
  } else {
    // Smooth transition between start and full effect
    float t = (lum - transitionStart) / (fullEffectStart - transitionStart);
    // Use smooth cubic for natural film-like response
    return smoothStep3(t);
  }
}

// Enhanced shadow mask with Lightroom-style lift
// Preserves shadow detail with smooth transitions
float shadowMask(float lum) {
  // Shadows primarily affect luminance < 0.5
  // Start transitioning around 0.4, full effect by 0.15
  
  float transitionStart = 0.4;
  float fullEffectStart = 0.15;
  
  if (lum > transitionStart) {
    return 0.0;
  } else if (lum <= fullEffectStart) {
    return 1.0;
  } else {
    // Smooth transition between start and full effect
    // As lum increases from 0.15 to 0.4, mask should decrease from 1 to 0
    float t = (lum - fullEffectStart) / (transitionStart - fullEffectStart);
    // Invert: smoothStep3(t) goes from 0 to 1, we want 1 to 0
    return 1.0 - smoothStep3(t);
  }
}

// White point mask - affects brightest values (Lightroom-style)
// Adjustment range: luminance > 0.75
float whiteMask(float lum) {
  // Whites affect the brightest 25% of the image
  // Start at 0.75, full effect at 1.0
  
  if (lum < 0.75) {
    return 0.0;
  } else if (lum >= 1.0) {
    return 1.0;
  } else {
    // Smooth transition for natural blend
    float t = (lum - 0.75) / 0.25;
    return smoothStep3(t);
  }
}

// Black point mask - affects darkest values (Lightroom-style)
// Adjustment range: luminance < 0.15
float blackMask(float lum) {
  // Blacks affect the darkest 15% of the image
  // Full effect at 0.0, no effect at 0.15
  
  if (lum > 0.15) {
    return 0.0;
  } else if (lum <= 0.0) {
    return 1.0;
  } else {
    // Smooth transition for natural blend
    // Inverted: as lum increases from 0 to 0.15, mask decreases from 1 to 0
    float t = lum / 0.15;
    return 1.0 - smoothStep3(t);
  }
}

// Apply exposure (photographic stops: +1 = double brightness)
vec3 applyExposure(vec3 color, float exposure) {
  return color * pow(2.0, exposure);
}

// Apply contrast (Lightroom-style power curve)
// Uses power function around 18% grey fulcrum for perceptually accurate contrast
// Matches Lightroom's behavior: +contrast = increases separation
vec3 applyContrast(vec3 color, float contrast) {
  // Grey fulcrum at 18% (photographic middle grey in linear space)
  // This matches both Darktable and Lightroom for perceptually correct contrast
  const float grey_fulcrum = 0.1845;
  
  // If no contrast adjustment, return original
  if (abs(contrast) < 0.01) {
    return color;
  }
  
  // Normalize contrast from [-100, 100] to a gamma range
  // Contrast +100 = gamma 0.5 (maximum separation)
  // Contrast -100 = gamma 2.0 (minimum separation)
  // Contrast 0 = gamma 1.0 (no change)
  float normalizedContrast = contrast / 100.0; // Range: -1.0 to 1.0
  
  // Power curve for gamma calculation
  // Using: gamma = 2^(-normalizedContrast) for natural film-like response
  // This gives us:
  // normalizedContrast = +1.0 → gamma = 0.5 (maximum contrast)
  // normalizedContrast = 0.0 → gamma = 1.0 (no change)
  // normalizedContrast = -1.0 → gamma = 2.0 (reduced contrast)
  float gamma = pow(2.0, -normalizedContrast);
  
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

// Apply highlights with smooth, film-like rolloff
// Negative values compress highlights (recover detail), positive values brighten them
vec3 applyHighlights(vec3 color, float highlights) {
  if (abs(highlights) < 0.01) {
    return color;
  }
  
  float lum = getLuminance(color);
  float mask = highlightMask(lum);
  
  // Normalize adjustment to -1.0 to 1.0 range
  float adjustment = highlights / 100.0;
  
  // Apply adjustment with smooth falloff
  // The mask ensures smooth transition from affected to unaffected areas
  // Strength: ±0.7 (70% max adjustment for natural look)
  float factor = 1.0 + adjustment * mask * 0.7;
  
  // Clamp to reasonable values (prevent complete blackout or extreme brightening)
  factor = clamp(factor, 0.4, 1.8);
  
  return color * factor;
}

// Apply shadows with smooth, film-like lift
// Positive values lift shadows (brighten dark areas), negative values crush them
vec3 applyShadows(vec3 color, float shadows) {
  if (abs(shadows) < 0.01) {
    return color;
  }
  
  float lum = getLuminance(color);
  float mask = shadowMask(lum);
  
  // Normalize adjustment to -1.0 to 1.0 range
  float adjustment = shadows / 100.0;
  
  // Apply adjustment with smooth falloff
  // The mask ensures smooth transition from affected to unaffected areas
  // Strength: ±0.8 (80% max adjustment for shadow lifting capability)
  float factor = 1.0 + adjustment * mask * 0.8;
  
  // Clamp to reasonable values
  factor = clamp(factor, 0.2, 2.0);
  
  return color * factor;
}

// Apply whites (affects brightest values - white point adjustment)
// Adjusts the clipping point for the brightest tones
vec3 applyWhites(vec3 color, float whites) {
  if (abs(whites) < 0.01) {
    return color;
  }
  
  float lum = getLuminance(color);
  float mask = whiteMask(lum);
  
  // Normalize adjustment
  float adjustment = whites / 100.0;
  
  // Apply adjustment with smooth falloff using the mask
  // Whites have a lighter touch than highlights for finer control
  // Strength: ±0.5 (50% max adjustment)
  float factor = 1.0 + adjustment * mask * 0.5;
  
  // Clamp to reasonable values
  factor = clamp(factor, 0.5, 1.5);
  
  return color * factor;
}

// Apply blacks (affects darkest values - black point adjustment)
// Adjusts the clipping point for the darkest tones
vec3 applyBlacks(vec3 color, float blacks) {
  if (abs(blacks) < 0.01) {
    return color;
  }
  
  float lum = getLuminance(color);
  float mask = blackMask(lum);
  
  // Normalize adjustment
  float adjustment = blacks / 100.0;
  
  // Apply adjustment with smooth falloff using the mask
  // Blacks have a lighter touch than shadows for finer control
  // Strength: ±0.5 (50% max adjustment)
  float factor = 1.0 + adjustment * mask * 0.5;
  
  // Clamp to reasonable values
  factor = clamp(factor, 0.4, 1.6);
  
  return color * factor;
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
