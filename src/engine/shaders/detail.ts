/**
 * Detail Adjustment Shader
 * Handles sharpening, clarity, and noise reduction
 */

export const detailVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const detailFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_texelSize;      // 1.0 / texture dimensions
uniform float u_sharpening;    // 0.0 to 150.0
uniform float u_noiseReductionLuma;  // 0.0 to 100.0
uniform float u_noiseReductionColor; // 0.0 to 100.0

out vec4 fragColor;

// Luminance calculation
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Sample texture with offset
vec3 sampleOffset(vec2 offset) {
  return texture(u_texture, v_texCoord + offset * u_texelSize).rgb;
}

// Lightroom-style unsharp mask sharpening
vec3 applySharpen(vec3 center, float amount) {
  if (amount < 0.01) {
    return center;
  }
  
  // 3x3 Laplacian kernel for edge detection
  vec3 laplacian = vec3(0.0);
  laplacian += sampleOffset(vec2(-1.0, -1.0)) * -1.0;
  laplacian += sampleOffset(vec2( 0.0, -1.0)) * -1.0;
  laplacian += sampleOffset(vec2( 1.0, -1.0)) * -1.0;
  laplacian += sampleOffset(vec2(-1.0,  0.0)) * -1.0;
  laplacian += center * 8.0;
  laplacian += sampleOffset(vec2( 1.0,  0.0)) * -1.0;
  laplacian += sampleOffset(vec2(-1.0,  1.0)) * -1.0;
  laplacian += sampleOffset(vec2( 0.0,  1.0)) * -1.0;
  laplacian += sampleOffset(vec2( 1.0,  1.0)) * -1.0;
  
  // Apply sharpening in luminance channel only (prevents color fringing)
  float centerLum = getLuminance(center);
  float sharpenedLum = getLuminance(center + laplacian * (amount / 150.0));
  float lumDiff = sharpenedLum - centerLum;
  
  return center + vec3(lumDiff);
}

// Bilateral filter for noise reduction (preserves edges)
vec3 applyNoiseReduction(vec3 center, float lumaAmount, float colorAmount) {
  if (lumaAmount < 0.01 && colorAmount < 0.01) {
    return center;
  }
  
  vec3 result = center;
  float centerLum = getLuminance(center);
  
  // Bilateral filter parameters
  float spatialSigma = 1.0;
  float lumaSigma = 0.1 + (1.0 - lumaAmount / 100.0) * 0.4;
  float colorSigma = 0.1 + (1.0 - colorAmount / 100.0) * 0.4;
  
  vec3 sum = vec3(0.0);
  float weightSum = 0.0;
  
  // 5x5 kernel for bilateral filtering
  for (float y = -2.0; y <= 2.0; y += 1.0) {
    for (float x = -2.0; x <= 2.0; x += 1.0) {
      vec2 offset = vec2(x, y);
      vec3 sampleColor = sampleOffset(offset);
      float sampleLum = getLuminance(sampleColor);
      
      // Spatial weight
      float spatialDist = length(offset);
      float spatialWeight = exp(-spatialDist * spatialDist / (2.0 * spatialSigma * spatialSigma));
      
      // Luminance weight
      float lumaDist = abs(sampleLum - centerLum);
      float lumaWeight = exp(-lumaDist * lumaDist / (2.0 * lumaSigma * lumaSigma));
      
      // Color weight
      vec3 colorDist = sampleColor - center;
      float colorDistSq = dot(colorDist, colorDist);
      float colorWeight = exp(-colorDistSq / (2.0 * colorSigma * colorSigma));
      
      // Combined weight
      float weight = spatialWeight * lumaWeight * colorWeight;
      
      sum += sampleColor * weight;
      weightSum += weight;
    }
  }
  
  if (weightSum > 0.0) {
    result = sum / weightSum;
  }
  
  // Blend based on noise reduction amounts
  float blendFactor = max(lumaAmount, colorAmount) / 100.0;
  return mix(center, result, blendFactor);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Apply sharpening (unsharp mask)
  color = applySharpen(color, u_sharpening);
  
  // Note: Clarity is now handled by the ClarityPipeline using two-pass Gaussian blur
  // This provides higher quality results without halos or artifacts
  
  // Apply noise reduction (bilateral filter)
  color = applyNoiseReduction(color, u_noiseReductionLuma, u_noiseReductionColor);
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Detail adjustment parameters
 * Note: Clarity is now handled separately by ClarityPipeline
 */
export interface DetailAdjustments {
  sharpening: number;
  noiseReductionLuma: number;
  noiseReductionColor: number;
  texelSize: { width: number; height: number };
}

/**
 * Apply detail adjustment uniforms to shader program
 */
export function applyDetailUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  adjustments: DetailAdjustments
): void {
  const sharpeningLocation = uniforms.get('u_sharpening');
  if (sharpeningLocation) {
    gl.uniform1f(sharpeningLocation, adjustments.sharpening);
  }

  const noiseReductionLumaLocation = uniforms.get('u_noiseReductionLuma');
  if (noiseReductionLumaLocation) {
    gl.uniform1f(noiseReductionLumaLocation, adjustments.noiseReductionLuma);
  }

  const noiseReductionColorLocation = uniforms.get('u_noiseReductionColor');
  if (noiseReductionColorLocation) {
    gl.uniform1f(noiseReductionColorLocation, adjustments.noiseReductionColor);
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
