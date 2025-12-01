/**
 * Lens Blur Shaders
 * Implements depth-based lens blur with layered compositing
 * Based on game-engine depth of field techniques
 */

// Shared vertex shader
export const lensBlurVertexShader = `#version 300 es
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
 * Depth preprocessing shader
 * Applies bilateral filter to smooth depth while preserving edges
 */
export const depthBilateralFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_depth;      // Raw depth map
uniform sampler2D u_guide;      // Original image as guide
uniform vec2 u_resolution;      // Image resolution
uniform float u_spatialSigma;   // Spatial sigma (pixel distance)
uniform float u_rangeSigma;     // Range sigma (color difference)

out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  float centerDepth = texture(u_depth, v_texCoord).r;
  vec3 centerColor = texture(u_guide, v_texCoord).rgb;
  
  float sumDepth = 0.0;
  float sumWeight = 0.0;
  
  int radius = int(u_spatialSigma * 2.0);
  
  for (int dy = -radius; dy <= radius; dy++) {
    for (int dx = -radius; dx <= radius; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * texelSize;
      vec2 sampleUV = v_texCoord + offset;
      
      float sampleDepth = texture(u_depth, sampleUV).r;
      vec3 sampleColor = texture(u_guide, sampleUV).rgb;
      
      // Spatial weight (Gaussian)
      float spatialDist = length(vec2(float(dx), float(dy)));
      float spatialWeight = exp(-0.5 * (spatialDist * spatialDist) / (u_spatialSigma * u_spatialSigma));
      
      // Range weight (color similarity)
      float colorDist = length(sampleColor - centerColor);
      float rangeWeight = exp(-0.5 * (colorDist * colorDist) / (u_rangeSigma * u_rangeSigma));
      
      float weight = spatialWeight * rangeWeight;
      sumDepth += sampleDepth * weight;
      sumWeight += weight;
    }
  }
  
  float filteredDepth = sumDepth / max(sumWeight, 0.0001);
  fragColor = vec4(filteredDepth, filteredDepth, filteredDepth, 1.0);
}
`;

/**
 * Depth dilation shader
 * Expands foreground (near) depths slightly to prevent background bleeding
 */
export const depthDilateFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_depth;
uniform vec2 u_resolution;
uniform float u_dilateRadius;   // Dilation radius in pixels

out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  float maxDepth = 0.0;
  int radius = int(u_dilateRadius);
  
  // Find maximum depth (nearest) in neighborhood
  for (int dy = -radius; dy <= radius; dy++) {
    for (int dx = -radius; dx <= radius; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * texelSize;
      float dist = length(vec2(float(dx), float(dy)));
      
      if (dist <= u_dilateRadius) {
        float sampleDepth = texture(u_depth, v_texCoord + offset).r;
        maxDepth = max(maxDepth, sampleDepth);
      }
    }
  }
  
  fragColor = vec4(maxDepth, maxDepth, maxDepth, 1.0);
}
`;

/**
 * Layer mask generation shader
 * Creates soft masks for depth layers with smooth transitions
 */
export const layerMaskFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_depth;
uniform float u_layerIndex;     // 0 to N-1
uniform float u_numLayers;      // Total number of layers
uniform float u_transitionWidth; // Soft transition width (0-0.5)

out vec4 fragColor;

// Smoothstep with configurable edges
float softMask(float depth, float start, float end, float transition) {
  float leftEdge = smoothstep(start - transition, start + transition, depth);
  float rightEdge = 1.0 - smoothstep(end - transition, end + transition, depth);
  return clamp(leftEdge * rightEdge, 0.0, 1.0);
}

void main() {
  float depth = texture(u_depth, v_texCoord).r;
  
  float layerSize = 1.0 / u_numLayers;
  float start = u_layerIndex * layerSize;
  float end = start + layerSize;
  
  float alpha = softMask(depth, start, end, u_transitionWidth);
  
  fragColor = vec4(alpha, alpha, alpha, 1.0);
}
`;

/**
 * Variable radius Gaussian blur shader
 * Samples at varying distances based on blur radius
 */
export const variableBlurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform sampler2D u_mask;       // Layer mask
uniform vec2 u_direction;       // [1,0] horizontal, [0,1] vertical
uniform float u_radius;         // Blur radius for this layer
uniform vec2 u_resolution;

out vec4 fragColor;

// Gaussian weights for 13-tap kernel
const float weights[7] = float[](
  0.1964825501511404,
  0.17466632194100552,
  0.12098536225957168,
  0.06559061143054536,
  0.027834904067191824,
  0.009245751331800536,
  0.002403157186906646
);

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec2 offset = u_direction * texelSize * u_radius;
  
  vec4 centerSample = texture(u_texture, v_texCoord);
  float maskValue = texture(u_mask, v_texCoord).r;
  
  // If mask is zero, just return the original
  if (maskValue < 0.001) {
    fragColor = centerSample;
    return;
  }
  
  vec3 result = centerSample.rgb * weights[0];
  
  // Sample in both directions
  for (int i = 1; i < 7; i++) {
    vec2 sampleOffset = offset * float(i);
    
    vec3 sample1 = texture(u_texture, v_texCoord + sampleOffset).rgb;
    vec3 sample2 = texture(u_texture, v_texCoord - sampleOffset).rgb;
    
    result += (sample1 + sample2) * weights[i];
  }
  
  // Blend based on mask
  vec3 blurred = result;
  fragColor = vec4(blurred, 1.0);
}
`;

/**
 * Depth-weighted composite shader
 * Combines all blurred layers with depth-aware blending
 */
export const depthCompositeFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_original;       // Original sharp image
uniform sampler2D u_depth;          // Depth map
uniform sampler2D u_blurredLayer0;  // Far background (most blurred)
uniform sampler2D u_blurredLayer1;
uniform sampler2D u_blurredLayer2;
uniform sampler2D u_blurredLayer3;
uniform sampler2D u_blurredLayer4;
uniform sampler2D u_blurredLayer5;
uniform sampler2D u_blurredLayer6;
uniform sampler2D u_blurredLayer7;  // Near foreground (least blurred)

uniform float u_layerDepths[8];     // Center depth for each layer
uniform float u_sigmaDepth;         // Depth blending sigma
uniform float u_focusDepth;         // Focus point (0-1, 1=near, 0=far)
uniform float u_focusRange;         // Range around focus that stays sharp
uniform float u_amount;             // Overall blur amount
uniform float u_edgeProtect;        // Edge protection strength
uniform int u_numLayers;            // Active number of layers

out vec4 fragColor;

vec3 sampleLayer(int index) {
  if (index == 0) return texture(u_blurredLayer0, v_texCoord).rgb;
  if (index == 1) return texture(u_blurredLayer1, v_texCoord).rgb;
  if (index == 2) return texture(u_blurredLayer2, v_texCoord).rgb;
  if (index == 3) return texture(u_blurredLayer3, v_texCoord).rgb;
  if (index == 4) return texture(u_blurredLayer4, v_texCoord).rgb;
  if (index == 5) return texture(u_blurredLayer5, v_texCoord).rgb;
  if (index == 6) return texture(u_blurredLayer6, v_texCoord).rgb;
  return texture(u_blurredLayer7, v_texCoord).rgb;
}

void main() {
  float depth = texture(u_depth, v_texCoord).r;
  vec3 original = texture(u_original, v_texCoord).rgb;
  
  // DEBUG: Output blur factor as red intensity to see variation
  // This shows where blur should be strong (red) vs sharp (black)
  float distFromFocus = abs(depth - u_focusDepth);
  float blurFactor = smoothstep(u_focusRange * 0.5, u_focusRange * 0.5 + 0.3, distFromFocus);
  blurFactor *= u_amount;
  
  // Uncomment for debug visualization:
  // fragColor = vec4(blurFactor, depth, 0.0, 1.0); // R=blur, G=depth
  // return;
  
  // If blur factor is very small, return original
  
  // If blur factor is very small, return original
  if (blurFactor < 0.01) {
    fragColor = vec4(original, 1.0);
    return;
  }
  
  // Depth-weighted layer blending
  vec3 accumulated = vec3(0.0);
  float totalWeight = 0.0;
  
  for (int i = 0; i < 8; i++) {
    if (i >= u_numLayers) break;
    
    vec3 layerColor = sampleLayer(i);
    float layerDepth = u_layerDepths[i];
    
    // Weight by depth proximity
    float depthDiff = abs(layerDepth - depth);
    float weight = exp(-0.5 * (depthDiff * depthDiff) / (u_sigmaDepth * u_sigmaDepth));
    
    accumulated += layerColor * weight;
    totalWeight += weight;
  }
  
  vec3 blurred = accumulated / max(totalWeight, 0.0001);
  
  // Edge protection: reduce blur at depth discontinuities
  vec2 texelSize = 1.0 / vec2(textureSize(u_depth, 0));
  float depthLeft = texture(u_depth, v_texCoord - vec2(texelSize.x, 0.0)).r;
  float depthRight = texture(u_depth, v_texCoord + vec2(texelSize.x, 0.0)).r;
  float depthUp = texture(u_depth, v_texCoord - vec2(0.0, texelSize.y)).r;
  float depthDown = texture(u_depth, v_texCoord + vec2(0.0, texelSize.y)).r;
  
  float depthGradient = max(
    abs(depthLeft - depthRight),
    abs(depthUp - depthDown)
  );
  
  float edgeMask = 1.0 - smoothstep(0.05, 0.2, depthGradient) * u_edgeProtect;
  
  // Final blend
  blurFactor *= edgeMask;
  vec3 finalColor = mix(original, blurred, blurFactor);
  
  fragColor = vec4(finalColor, 1.0);
}
`;

/**
 * Focus point visualization shader (for preview)
 */
export const focusVisualizationFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;    // Current image
uniform sampler2D u_depth;      // Depth map
uniform float u_focusDepth;     // Focus point depth
uniform float u_focusRange;     // Focus range
uniform bool u_showDepth;       // Show depth map overlay
uniform bool u_showFocus;       // Show focus indicator

out vec4 fragColor;

void main() {
  vec3 color = texture(u_texture, v_texCoord).rgb;
  vec4 depthTexel = texture(u_depth, v_texCoord);
  float depth = depthTexel.r;
  
  if (u_showDepth) {
    // Visualize depth as a smooth gradient from blue (far) to red (near)
    // Using a perceptually smooth color gradient
    vec3 depthColor;
    
    if (depth < 0.5) {
      // Far to mid: Blue to Cyan to Green
      float t = depth * 2.0;  // 0 to 1 for first half
      depthColor = mix(vec3(0.0, 0.2, 1.0), vec3(0.0, 1.0, 0.5), t);
    } else {
      // Mid to near: Green to Yellow to Red
      float t = (depth - 0.5) * 2.0;  // 0 to 1 for second half
      depthColor = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.2, 0.0), t);
    }
    
    // Mix with original image
    color = mix(color, depthColor, 0.7);
  }
  
  if (u_showFocus) {
    // Highlight areas in focus with green tint
    float distFromFocus = abs(depth - u_focusDepth);
    float inFocus = 1.0 - smoothstep(0.0, u_focusRange * 0.5, distFromFocus);
    
    if (inFocus > 0.5) {
      // Green outline for focus area
      vec2 texelSize = 1.0 / vec2(textureSize(u_depth, 0));
      float edge = 0.0;
      
      for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
          vec2 offset = vec2(float(dx), float(dy)) * texelSize;
          float neighborDepth = texture(u_depth, v_texCoord + offset).r;
          float neighborFocus = 1.0 - smoothstep(0.0, u_focusRange * 0.5, abs(neighborDepth - u_focusDepth));
          edge += abs(inFocus - neighborFocus);
        }
      }
      
      if (edge > 0.1) {
        color = mix(color, vec3(0.2, 1.0, 0.2), 0.7);
      }
    }
  }
  
  fragColor = vec4(color, 1.0);
}
`;

/**
 * Lens Blur Parameters Interface
 */
export interface LensBlurParams {
  enabled: boolean;
  amount: number;           // 0.0 to 2.5 - overall blur strength
  maxBlur: number;          // 8 to 120 pixels - maximum blur radius
  focusDepth: number;       // 0.0 to 1.0 - depth at which image is in focus
  focusRange: number;       // 0.0 to 0.5 - range around focus that stays sharp
  edgeProtect: number;      // 0.0 to 1.0 - edge protection strength
  numLayers: number;        // 4 to 12 - number of depth layers
  transitionWidth: number;  // 0.0 to 0.1 - layer transition softness
  showDepth: boolean;       // Show depth map overlay
  showFocus: boolean;       // Show focus indicator
}

/**
 * Default Lens Blur Parameters
 */
export const defaultLensBlurParams: LensBlurParams = {
  enabled: false,
  amount: 1.0,
  maxBlur: 60,
  focusDepth: 0.5,
  focusRange: 0.1,
  edgeProtect: 0.6,
  numLayers: 4,  // Reduced from 8 for performance
  transitionWidth: 0.04,
  showDepth: false,
  showFocus: false,
};

/**
 * Simple depth-aware blur shader
 * Direct per-pixel blur based on depth - simpler than multi-layer approach
 */
export const simpleDepthBlurFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;    // Image to blur
uniform sampler2D u_depth;      // Depth map
uniform vec2 u_resolution;
uniform float u_focusDepth;     // 0-1, depth that should be sharp
uniform float u_focusRange;     // Range around focus that stays sharp
uniform float u_maxBlur;        // Maximum blur radius in pixels
uniform float u_amount;         // Overall blur strength
uniform vec2 u_direction;       // Blur direction (1,0) or (0,1)

out vec4 fragColor;

void main() {
  vec4 depthSample = texture(u_depth, v_texCoord);
  float depth = depthSample.r;
  vec2 texelSize = 1.0 / u_resolution;
  
  // DEBUG: Output BRIGHT MAGENTA to confirm this shader is running
  fragColor = vec4(1.0, 0.0, 1.0, 1.0);  // Magenta
  return;
  
  // DEBUG: Uncomment to visualize depth
  // fragColor = vec4(depth, depth, depth, 1.0);
  // return;
  
  // Calculate blur radius based on depth
  float distFromFocus = abs(depth - u_focusDepth);
  float blurFactor = smoothstep(u_focusRange * 0.5, u_focusRange * 0.5 + 0.2, distFromFocus);
  float radius = blurFactor * u_maxBlur * u_amount;
  
  // DEBUG: Visualize blur factor (red = blurry, black = sharp) - ENABLED FOR TESTING
  fragColor = vec4(blurFactor, depth, 0.0, 1.0);  // R=blur, G=depth
  return;
  
  // If radius is very small, just return the original
  if (radius < 0.5) {
    fragColor = texture(u_texture, v_texCoord);
    return;
  }
  
  // Gaussian blur with dynamic radius
  vec3 result = vec3(0.0);
  float totalWeight = 0.0;
  
  int samples = int(min(radius * 2.0 + 1.0, 31.0));  // Cap at 31 samples
  float sigma = radius / 2.0;
  
  for (int i = 0; i < 31; i++) {
    if (i >= samples) break;
    
    float offset = float(i) - float(samples - 1) / 2.0;
    vec2 sampleUV = v_texCoord + u_direction * texelSize * offset;
    
    // Gaussian weight
    float weight = exp(-0.5 * (offset * offset) / (sigma * sigma));
    
    // Sample and accumulate
    vec3 sampleColor = texture(u_texture, sampleUV).rgb;
    result += sampleColor * weight;
    totalWeight += weight;
  }
  
  fragColor = vec4(result / totalWeight, 1.0);
}
`;

/**
 * Calculate blur radius for each layer based on depth
 */
export function calculateLayerBlurRadius(
  layerIndex: number,
  numLayers: number,
  focusDepth: number,
  focusRange: number,
  maxBlur: number,
  amount: number
): number {
  const layerSize = 1.0 / numLayers;
  const layerCenter = layerIndex * layerSize + layerSize * 0.5;
  
  // Distance from focus point
  const distFromFocus = Math.abs(layerCenter - focusDepth);
  
  // Blur increases with distance from focus
  const normalizedDist = Math.max(0, distFromFocus - focusRange * 0.5) / (1.0 - focusRange);
  const blurFactor = Math.pow(normalizedDist, 1.2); // Slight gamma for smooth falloff
  
  return Math.min(maxBlur, blurFactor * maxBlur * amount);
}

/**
 * Get layer center depths for composite shader
 */
export function getLayerDepthCenters(numLayers: number): number[] {
  const centers: number[] = [];
  const layerSize = 1.0 / numLayers;
  
  for (let i = 0; i < numLayers; i++) {
    centers.push(i * layerSize + layerSize * 0.5);
  }
  
  return centers;
}
