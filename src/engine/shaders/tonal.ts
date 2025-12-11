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

// Apply exposure (Lightroom algorithm with strong highlight protection)
// Applies exposure evenly across tonal range with aggressive highlight rolloff
// Prevents bright areas from blooming while lifting shadows proportionally
vec3 applyExposure(vec3 color, float exposure) {
  if (abs(exposure) < 0.01) {
    return color;
  }
  
  // Calculate base exposure multiplier
  float scale = pow(2.0, exposure);
  
  // Apply per-channel with luminance-based highlight protection
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float val = color[i];
    
    // Lightroom's approach: strong compression curve for highlights
    // This prevents any area from blooming disproportionately
    float adjusted;
    
    if (val < 0.18) {
      // Shadows to midtones: full exposure effect
      adjusted = val * scale;
    } else if (val < 0.7) {
      // Upper midtones: gradually reduce exposure response
      float t = (val - 0.18) / (0.7 - 0.18);
      float compressionFactor = mix(1.0, 0.5, smoothStep3(t));
      adjusted = val * (1.0 + (scale - 1.0) * compressionFactor);
    } else {
      // Highlights: strong compression to prevent blooming
      // Bright areas get minimal exposure increase
      float t = (val - 0.7) / 0.3;
      float compressionFactor = mix(0.5, 0.15, smoothStep3(t));
      adjusted = val * (1.0 + (scale - 1.0) * compressionFactor);
    }
    
    result[i] = adjusted;
  }
  
  return result;
}

// Apply contrast (Lightroom algorithm)
// Parametric S-curve: y = (x - 0.5) * c + 0.5
// With sigmoid rolloffs to preserve clipping points
vec3 applyContrast(vec3 color, float contrast) {
  if (abs(contrast) < 0.01) {
    return color;
  }
  
  // Normalize contrast [-100, 100] to multiplier
  // Lightroom uses roughly 2x range for ±100
  float c = 1.0 + (contrast / 100.0) * 1.0;
  
  // Apply parametric S-curve around midpoint (0.5 in linear space)
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float x = color[i];
    
    // Basic S-curve
    float y = (x - 0.5) * c + 0.5;
    
    // Sigmoid rolloff to prevent clipping
    // Softens extreme highlights and shadows
    if (y > 0.9) {
      // Soft shoulder for highlights
      float t = (y - 0.9) / 0.1;
      y = 0.9 + 0.1 * smoothStep3(t);
    } else if (y < 0.1) {
      // Soft toe for shadows
      float t = y / 0.1;
      y = 0.1 * smoothStep3(t);
    }
    
    result[i] = y;
  }
  
  return result;
}

// Apply highlights (Lightroom algorithm)
// H(x) = x - w * max(x - T, 0)
// Regional weighted tone curve with threshold-based masking
vec3 applyHighlights(vec3 color, float highlights) {
  if (abs(highlights) < 0.01) {
    return color;
  }
  
  // Get luminance for threshold comparison
  float lum = getLuminance(color);
  
  // Threshold: affects pixels above this value
  // Lightroom uses ~0.5 as the midpoint
  const float T = 0.5;
  
  // Weight from slider: negative recovers, positive brightens
  // Scale to reasonable range
  float w = (highlights / 100.0) * 0.7;
  
  // Apply weighted adjustment above threshold
  float adjustment = w * max(lum - T, 0.0);
  
  // Apply to each channel while preserving color ratios
  vec3 result = color - vec3(adjustment);
  
  return result;
}

// Apply shadows (Lightroom algorithm)
// S(x) = x + w * max(T - x, 0)
// Regional weighted tone curve with threshold-based masking
vec3 applyShadows(vec3 color, float shadows) {
  if (abs(shadows) < 0.01) {
    return color;
  }
  
  // Get luminance for threshold comparison
  float lum = getLuminance(color);
  
  // Threshold: affects pixels below this value
  // Lightroom uses ~0.5 as the midpoint
  const float T = 0.5;
  
  // Weight from slider: positive lifts, negative crushes
  // Scale to reasonable range
  float w = (shadows / 100.0) * 0.8;
  
  // Apply weighted adjustment below threshold
  float adjustment = w * max(T - lum, 0.0);
  
  // Apply to each channel while preserving color ratios
  vec3 result = color + vec3(adjustment);
  
  return result;
}

// Apply whites (Lightroom algorithm)
// Shifts upper tone curve endpoint with soft-clipping
// Uses smoothstep for tapered rolloff
vec3 applyWhites(vec3 color, float whites) {
  if (abs(whites) < 0.01) {
    return color;
  }
  
  // Get luminance to identify bright regions
  float lum = getLuminance(color);
  
  // Whites affect brightest values (above 0.75)
  // Normalize slider to shift amount
  float shift = (whites / 100.0) * 0.3;
  
  // Apply soft-clipping with smoothstep taper
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float x = color[i];
    
    if (x > 0.75) {
      // Smoothstep taper for soft clipping
      float t = (x - 0.75) / 0.25;
      float smooth_t = smoothStep3(t);
      
      // Apply shift with taper
      result[i] = x + shift * smooth_t;
    } else {
      result[i] = x;
    }
  }
  
  return result;
}

// Apply blacks (Lightroom algorithm)
// Shifts lower tone curve endpoint with soft-clipping
// Uses smoothstep for tapered rolloff
vec3 applyBlacks(vec3 color, float blacks) {
  if (abs(blacks) < 0.01) {
    return color;
  }
  
  // Get luminance to identify dark regions
  float lum = getLuminance(color);
  
  // Blacks affect darkest values (below 0.15)
  // Normalize slider to shift amount
  float shift = (blacks / 100.0) * 0.25;
  
  // Apply soft-clipping with smoothstep taper
  vec3 result;
  for (int i = 0; i < 3; i++) {
    float x = color[i];
    
    if (x < 0.15) {
      // Smoothstep taper for soft clipping
      float t = x / 0.15;
      float smooth_t = smoothStep3(t);
      
      // Apply shift with taper (inverted because we're in shadows)
      result[i] = x + shift * (1.0 - smooth_t);
    } else {
      result[i] = x;
    }
  }
  
  return result;
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
