/**
 * Darktable-Inspired Sharpen Shader
 * Implements proper Unsharp Mask (USM) algorithm with:
 * - Gaussian blur for high-quality edge detection
 * - Threshold to avoid sharpening noise
 * - Radius control for sharpening scale
 * - Works on luminance only to prevent color fringing
 * 
 * Based on darktable's sharpen.c implementation
 * Copyright (C) 2009-2023 darktable developers (GPL v3)
 */

export const sharpenVertexShader = `#version 300 es
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
 * First pass: Horizontal Gaussian blur
 */
export const sharpenHBlurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_radius;  // 0.0 to 10.0

out vec4 fragColor;

// Gaussian weight calculation
float gaussianWeight(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
}

void main() {
  vec4 center = texture(u_texture, v_texCoord);
  
  if (u_radius < 0.5) {
    fragColor = center;
    return;
  }
  
  // Sigma is 2.5x smaller than radius (darktable convention)
  float sigma = u_radius / 2.5;
  int kernelRadius = int(ceil(u_radius));
  
  vec4 sum = vec4(0.0);
  float weightSum = 0.0;
  
  // Horizontal blur pass
  for (int i = -12; i <= 12; i++) {
    if (abs(i) > kernelRadius) continue;
    
    float weight = gaussianWeight(float(i), sigma);
    vec2 offset = vec2(float(i) * u_texelSize.x, 0.0);
    sum += texture(u_texture, v_texCoord + offset) * weight;
    weightSum += weight;
  }
  
  fragColor = sum / weightSum;
}
`;

/**
 * Second pass: Vertical Gaussian blur
 */
export const sharpenVBlurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_radius;

out vec4 fragColor;

float gaussianWeight(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
}

void main() {
  vec4 center = texture(u_texture, v_texCoord);
  
  if (u_radius < 0.5) {
    fragColor = center;
    return;
  }
  
  float sigma = u_radius / 2.5;
  int kernelRadius = int(ceil(u_radius));
  
  vec4 sum = vec4(0.0);
  float weightSum = 0.0;
  
  // Vertical blur pass
  for (int i = -12; i <= 12; i++) {
    if (abs(i) > kernelRadius) continue;
    
    float weight = gaussianWeight(float(i), sigma);
    vec2 offset = vec2(0.0, float(i) * u_texelSize.y);
    sum += texture(u_texture, v_texCoord + offset) * weight;
    weightSum += weight;
  }
  
  fragColor = sum / weightSum;
}
`;

/**
 * Third pass: Mix original with blurred to create sharpening
 * Implements Darktable's threshold-based unsharp mask
 */
export const sharpenMixFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_original;    // Original image
uniform sampler2D u_blurred;     // Gaussian blurred image
uniform float u_amount;          // 0.0 to 2.0 (strength)
uniform float u_threshold;       // 0.0 to 1.0 (noise gate)

out vec4 fragColor;

// Rec.709 luminance
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 original = texture(u_original, v_texCoord);
  vec4 blurred = texture(u_blurred, v_texCoord);
  
  if (u_amount < 0.01) {
    fragColor = original;
    return;
  }
  
  // Calculate luminance difference (high-frequency detail)
  float origLum = getLuminance(original.rgb);
  float blurLum = getLuminance(blurred.rgb);
  float diff = origLum - blurLum;
  float absDiff = abs(diff);
  
  // Apply threshold (darktable-style noise gate)
  // Only sharpen where difference exceeds threshold
  float detail = 0.0;
  if (absDiff > u_threshold) {
    // Subtract threshold and preserve sign
    detail = sign(diff) * max(absDiff - u_threshold, 0.0);
  }
  
  // Apply sharpening to luminance only (prevents color fringing)
  float sharpenedLum = origLum + detail * u_amount;
  
  // Reconstruct color by scaling original RGB to match new luminance
  vec3 result = original.rgb;
  if (origLum > 0.001) {
    float lumScale = sharpenedLum / origLum;
    result = original.rgb * lumScale;
  } else {
    // For very dark pixels, just add the detail
    result = original.rgb + vec3(detail * u_amount);
  }
  
  // Clamp to valid range
  result = clamp(result, 0.0, 1.0);
  
  fragColor = vec4(result, original.a);
}
`;

/**
 * Single-pass sharpen for simpler use cases
 * Uses Laplacian edge detection with threshold
 */
export const sharpenSimpleFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_amount;      // 0.0 to 2.0
uniform float u_radius;      // 0.5 to 10.0
uniform float u_threshold;   // 0.0 to 1.0

out vec4 fragColor;

float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Sample with radius scaling
vec3 sampleOffset(vec2 offset, float radius) {
  return texture(u_texture, v_texCoord + offset * u_texelSize * radius).rgb;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 center = texColor.rgb;
  
  if (u_amount < 0.01) {
    fragColor = texColor;
    return;
  }
  
  float radius = max(0.5, u_radius);
  
  // Gaussian-weighted 3x3 blur approximation
  vec3 blur = vec3(0.0);
  float totalWeight = 0.0;
  
  // Center has highest weight
  blur += center * 4.0;
  totalWeight += 4.0;
  
  // Direct neighbors (scaled by radius)
  blur += sampleOffset(vec2(-1.0, 0.0), radius) * 2.0;
  blur += sampleOffset(vec2(1.0, 0.0), radius) * 2.0;
  blur += sampleOffset(vec2(0.0, -1.0), radius) * 2.0;
  blur += sampleOffset(vec2(0.0, 1.0), radius) * 2.0;
  totalWeight += 8.0;
  
  // Diagonals
  blur += sampleOffset(vec2(-1.0, -1.0), radius);
  blur += sampleOffset(vec2(1.0, -1.0), radius);
  blur += sampleOffset(vec2(-1.0, 1.0), radius);
  blur += sampleOffset(vec2(1.0, 1.0), radius);
  totalWeight += 4.0;
  
  blur /= totalWeight;
  
  // Calculate luminance difference
  float origLum = getLuminance(center);
  float blurLum = getLuminance(blur);
  float diff = origLum - blurLum;
  float absDiff = abs(diff);
  
  // Apply threshold (darktable-style)
  float detail = 0.0;
  if (absDiff > u_threshold) {
    detail = sign(diff) * max(absDiff - u_threshold, 0.0);
  }
  
  // Apply to luminance only
  float sharpenedLum = origLum + detail * u_amount;
  
  // Reconstruct color
  vec3 result = center;
  if (origLum > 0.001) {
    float lumScale = sharpenedLum / origLum;
    result = center * lumScale;
  } else {
    result = center + vec3(detail * u_amount);
  }
  
  result = clamp(result, 0.0, 1.0);
  fragColor = vec4(result, texColor.a);
}
`;

/**
 * Sharpen adjustment parameters (Darktable-style)
 */
export interface SharpenAdjustments {
  amount: number;     // 0.0 to 2.0 (default 0.5)
  radius: number;     // 0.5 to 10.0 (default 2.0)
  threshold: number;  // 0.0 to 1.0 (default 0.005)
  texelSize: { width: number; height: number };
}

/**
 * Default sharpen parameters matching Darktable defaults
 */
export const defaultSharpenAdjustments: SharpenAdjustments = {
  amount: 0.5,
  radius: 2.0,
  threshold: 0.005,
  texelSize: { width: 1, height: 1 },
};

/**
 * Apply sharpen uniforms to shader program (simple single-pass version)
 */
export function applySharpenUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: SharpenAdjustments
): void {
  const amountLocation = uniforms.get('u_amount');
  if (amountLocation) {
    gl.uniform1f(amountLocation, adjustments.amount);
  }

  const radiusLocation = uniforms.get('u_radius');
  if (radiusLocation) {
    gl.uniform1f(radiusLocation, adjustments.radius);
  }

  const thresholdLocation = uniforms.get('u_threshold');
  if (thresholdLocation) {
    gl.uniform1f(thresholdLocation, adjustments.threshold);
  }

  const texelSizeLocation = uniforms.get('u_texelSize');
  if (texelSizeLocation) {
    gl.uniform2f(
      texelSizeLocation,
      1.0 / adjustments.texelSize.width,
      1.0 / adjustments.texelSize.height
    );
  }
}

/**
 * Apply horizontal blur uniforms
 */
export function applySharpenHBlurUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  radius: number,
  texelSize: { width: number; height: number }
): void {
  const radiusLocation = uniforms.get('u_radius');
  if (radiusLocation) {
    gl.uniform1f(radiusLocation, radius);
  }

  const texelSizeLocation = uniforms.get('u_texelSize');
  if (texelSizeLocation) {
    gl.uniform2f(
      texelSizeLocation,
      1.0 / texelSize.width,
      1.0 / texelSize.height
    );
  }
}

/**
 * Apply mix/final pass uniforms
 */
export function applySharpenMixUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  amount: number,
  threshold: number
): void {
  const amountLocation = uniforms.get('u_amount');
  if (amountLocation) {
    gl.uniform1f(amountLocation, amount);
  }

  const thresholdLocation = uniforms.get('u_threshold');
  if (thresholdLocation) {
    gl.uniform1f(thresholdLocation, threshold);
  }
}

