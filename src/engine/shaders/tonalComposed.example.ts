/**
 * Tonal Adjustment Shader (Composed Version)
 * 
 * Example of using the shader composition system to create modular shaders.
 * This demonstrates how to use #include directives to import library functions.
 * 
 * @module tonalComposed
 * @version 1.0.0
 * @requires colorSpaceUtils
 * @requires mathUtils
 */

import { composeShader } from '../shaderComposer';

/**
 * Vertex shader (standard passthrough)
 */
export const tonalComposedVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Fragment shader with library includes
 * 
 * This shader uses the composition system to include utility functions
 * from the shader library instead of duplicating code.
 */
const tonalComposedFragmentShaderSource = `#version 300 es
precision highp float;

// Include shader libraries
#include "colorSpaceUtils"
#include "mathUtils"

// Inputs
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_texture;
uniform float u_exposure;      // -5.0 to +5.0 stops
uniform float u_contrast;      // -100.0 to +100.0
uniform float u_highlights;    // -100.0 to +100.0
uniform float u_shadows;       // -100.0 to +100.0
uniform float u_whites;        // -100.0 to +100.0
uniform float u_blacks;        // -100.0 to +100.0

// Output
out vec4 fragColor;

// ============================================================================
// Tonal Adjustment Functions
// ============================================================================

/**
 * Apply photographic exposure adjustment
 * 
 * Uses proper photographic stops: +1 stop = double brightness
 * 
 * @param color - Input color in linear space
 * @param exposure - Exposure in stops
 * @return Adjusted color
 */
vec3 applyExposure(vec3 color, float exposure) {
    return color * pow(2.0, exposure);
}

/**
 * Apply contrast adjustment around midpoint
 * 
 * @param color - Input color in linear space
 * @param contrast - Contrast adjustment [-100 to +100]
 * @return Adjusted color
 */
vec3 applyContrast(vec3 color, float contrast) {
    float factor = 1.0 + (contrast / 100.0);
    return (color - 0.5) * factor + 0.5;
}

/**
 * Apply highlights adjustment (affects bright areas)
 * 
 * Uses luminance-based masking with smooth falloff.
 * 
 * @param color - Input color in linear space
 * @param highlights - Highlights adjustment [-100 to +100]
 * @return Adjusted color
 */
vec3 applyHighlights(vec3 color, float highlights) {
    float lum = getLuminance(color);
    
    // Create mask for bright areas (lum > 0.7)
    float mask = highlightMask(lum, 0.7, 0.3);
    
    float adjustment = highlights / 100.0;
    return color * (1.0 + adjustment * mask);
}

/**
 * Apply shadows adjustment (affects dark areas)
 * 
 * @param color - Input color in linear space
 * @param shadows - Shadows adjustment [-100 to +100]
 * @return Adjusted color
 */
vec3 applyShadows(vec3 color, float shadows) {
    float lum = getLuminance(color);
    
    // Create mask for dark areas (lum < 0.3)
    float mask = shadowMask(lum, 0.3, 0.3);
    
    float adjustment = shadows / 100.0;
    return color * (1.0 + adjustment * mask);
}

/**
 * Apply whites adjustment (affects very bright areas)
 * 
 * @param color - Input color in linear space
 * @param whites - Whites adjustment [-100 to +100]
 * @return Adjusted color
 */
vec3 applyWhites(vec3 color, float whites) {
    float lum = getLuminance(color);
    
    // Create mask for very bright areas (lum > 0.85)
    float mask = highlightMask(lum, 0.85, 0.15);
    
    float adjustment = whites / 100.0;
    return color * (1.0 + adjustment * mask);
}

/**
 * Apply blacks adjustment (affects very dark areas)
 * 
 * @param color - Input color in linear space
 * @param blacks - Blacks adjustment [-100 to +100]
 * @return Adjusted color
 */
vec3 applyBlacks(vec3 color, float blacks) {
    float lum = getLuminance(color);
    
    // Create mask for very dark areas (lum < 0.15)
    float mask = shadowMask(lum, 0.15, 0.15);
    
    float adjustment = blacks / 100.0;
    return color * (1.0 + adjustment * mask);
}

// ============================================================================
// Main Shader
// ============================================================================

void main() {
    // Sample texture
    vec4 texColor = texture(u_texture, v_texCoord);
    vec3 color = texColor.rgb;
    
    // Convert to linear color space for accurate color math
    // Uses sRGBToLinear() from colorSpaceUtils library
    color = sRGBToLinear(color);
    
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
    
    // Clamp to valid range using clamp01() from mathUtils
    color = clamp01(color);
    
    // Convert back to sRGB for display
    // Uses linearToSRGB() from colorSpaceUtils library
    color = linearToSRGB(color);
    
    fragColor = vec4(color, texColor.a);
}
`;

/**
 * Composed fragment shader (with includes resolved)
 * 
 * This is the final shader source with all #include directives processed.
 */
export const tonalComposedFragmentShader = composeShader(
  tonalComposedFragmentShaderSource
);

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
 * 
 * @param gl - WebGL2 rendering context
 * @param uniforms - Map of uniform locations
 * @param adjustments - Adjustment parameters
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
