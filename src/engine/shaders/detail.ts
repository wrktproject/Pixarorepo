/**
 * Detail Adjustment Shader
 * Darktable-inspired sharpening with radius and threshold
 * Plus noise reduction using bilateral filter
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
uniform vec2 u_texelSize;              // 1.0 / texture dimensions
uniform float u_sharpening;            // 0.0 to 150.0 (amount)
uniform float u_sharpenRadius;         // 0.5 to 10.0
uniform float u_sharpenThreshold;      // 0.0 to 100.0
uniform float u_noiseReductionLuma;    // 0.0 to 100.0
uniform float u_noiseReductionColor;   // 0.0 to 100.0

out vec4 fragColor;

// Rec.709 luminance calculation
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Sample texture with offset scaled by radius
vec3 sampleOffset(vec2 offset, float radius) {
  return texture(u_texture, v_texCoord + offset * u_texelSize * radius).rgb;
}

// Gaussian weight for blur kernel
float gaussianWeight(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
}

/**
 * Darktable-style Unsharp Mask sharpening
 * - Applies Gaussian blur to find low-frequency content
 * - Subtracts blur from original to get high-frequency detail
 * - Uses threshold to avoid sharpening noise
 * - Works on luminance only to prevent color fringing
 */
vec3 applySharpen(vec3 center, float amount, float radius, float threshold) {
  if (amount < 1.0) {
    return center;
  }
  
  // Normalize amount to 0-2 range (150 maps to ~2.0)
  float normalizedAmount = amount / 75.0;
  
  // Normalize threshold to 0-0.1 range
  float normalizedThreshold = threshold / 1000.0;
  
  // Sigma for Gaussian (darktable uses radius / 2.5)
  float sigma = radius / 2.5;
  
  // Calculate blurred luminance using 5x5 Gaussian approximation
  float blurLum = 0.0;
  float totalWeight = 0.0;
  
  // Sample in a cross pattern scaled by radius for efficiency
  for (float i = -2.0; i <= 2.0; i += 1.0) {
    float weight = gaussianWeight(i, sigma);
    
    // Horizontal samples
    vec3 hSample = sampleOffset(vec2(i, 0.0), radius);
    blurLum += getLuminance(hSample) * weight;
    totalWeight += weight;
    
    // Vertical samples (skip center to avoid double-counting)
    if (i != 0.0) {
      vec3 vSample = sampleOffset(vec2(0.0, i), radius);
      blurLum += getLuminance(vSample) * weight;
      totalWeight += weight;
    }
  }
  
  // Add diagonal samples for better quality
  float diagWeight = gaussianWeight(1.414, sigma);
  blurLum += getLuminance(sampleOffset(vec2(-1.0, -1.0), radius)) * diagWeight;
  blurLum += getLuminance(sampleOffset(vec2(1.0, -1.0), radius)) * diagWeight;
  blurLum += getLuminance(sampleOffset(vec2(-1.0, 1.0), radius)) * diagWeight;
  blurLum += getLuminance(sampleOffset(vec2(1.0, 1.0), radius)) * diagWeight;
  totalWeight += diagWeight * 4.0;
  
  blurLum /= totalWeight;
  
  // Calculate luminance difference (high-frequency detail)
  float origLum = getLuminance(center);
  float diff = origLum - blurLum;
  float absDiff = abs(diff);
  
  // Apply threshold (darktable-style noise gate)
  // Only sharpen where difference exceeds threshold
  float detail = 0.0;
  if (absDiff > normalizedThreshold) {
    detail = sign(diff) * (absDiff - normalizedThreshold);
  }
  
  // Apply sharpening to luminance only
  float sharpenedLum = origLum + detail * normalizedAmount;
  
  // Reconstruct color by scaling RGB to match new luminance
  vec3 result = center;
  if (origLum > 0.001) {
    float lumScale = sharpenedLum / origLum;
    result = center * lumScale;
  } else {
    result = center + vec3(detail * normalizedAmount);
  }
  
  return clamp(result, 0.0, 1.0);
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
      vec3 sampleColor = texture(u_texture, v_texCoord + offset * u_texelSize).rgb;
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
  
  // Apply Darktable-style sharpening (unsharp mask with threshold)
  color = applySharpen(color, u_sharpening, u_sharpenRadius, u_sharpenThreshold);
  
  // Apply noise reduction (bilateral filter)
  color = applyNoiseReduction(color, u_noiseReductionLuma, u_noiseReductionColor);
  
  // Clamp to valid range
  color = clamp(color, 0.0, 1.0);
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Detail adjustment parameters
 */
export interface DetailAdjustments {
  sharpening: number;
  sharpenRadius: number;
  sharpenThreshold: number;
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

  const sharpenRadiusLocation = uniforms.get('u_sharpenRadius');
  if (sharpenRadiusLocation) {
    gl.uniform1f(sharpenRadiusLocation, adjustments.sharpenRadius);
  }

  const sharpenThresholdLocation = uniforms.get('u_sharpenThreshold');
  if (sharpenThresholdLocation) {
    gl.uniform1f(sharpenThresholdLocation, adjustments.sharpenThreshold);
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
