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

// Smooth curve for masking (Lightroom-style)
float smoothCurve(float x, float center, float width) {
  float t = clamp((x - center + width) / (2.0 * width), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t); // Smoothstep
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
  float normalized = (contrast / 100.0) * 0.5; // -0.5 to +0.5
  
  // Calculate gamma: smaller gamma = more contrast
  // At 0: gamma = 1.0 (no change)
  // At +100: gamma = 0.67 (moderate contrast increase)
  // At -100: gamma = 1.5 (moderate contrast decrease)
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

// Apply highlights (affects bright areas, lum > 0.5)
vec3 applyHighlights(vec3 color, float highlights) {
  float lum = getLuminance(color);
  float mask = smoothCurve(lum, 0.7, 0.3);
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (highlights / 100.0) * 0.5;
  return color * (1.0 + adjustment * mask);
}

// Apply shadows (affects dark areas, lum < 0.5)
vec3 applyShadows(vec3 color, float shadows) {
  float lum = getLuminance(color);
  float mask = 1.0 - smoothCurve(lum, 0.3, 0.3);
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (shadows / 100.0) * 0.5;
  return color * (1.0 + adjustment * mask);
}

// Apply whites (affects very bright areas, lum > 0.8)
vec3 applyWhites(vec3 color, float whites) {
  float lum = getLuminance(color);
  float mask = smoothCurve(lum, 0.85, 0.15);
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (whites / 100.0) * 0.5;
  return color * (1.0 + adjustment * mask);
}

// Apply blacks (affects very dark areas, lum < 0.2)
vec3 applyBlacks(vec3 color, float blacks) {
  float lum = getLuminance(color);
  float mask = 1.0 - smoothCurve(lum, 0.15, 0.15);
  // Reduce intensity by 50% for more subtle adjustments
  float adjustment = (blacks / 100.0) * 0.5;
  return color * (1.0 + adjustment * mask);
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
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  // Convert back to sRGB for display
  color = linearToSrgb(color);
  
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
