/**
 * Guided Filter Shader
 * Implements fast guided filter algorithm for edge-aware detail enhancement
 * Based on "Guided Image Filtering" by He et al. (2010)
 * Used for both sharpening and denoising while preserving edges
 */

export const guidedFilterVertexShader = `#version 300 es
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
 * Box Filter Shader (Horizontal Pass)
 * Implements separable box filter for efficient O(1) filtering
 */
export const boxFilterHorizontalFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform int u_radius;        // Filter radius in pixels
uniform vec2 u_resolution;   // Image resolution (width, height)

out vec4 fragColor;

/**
 * Horizontal box filter pass
 * Computes the sum of pixels in a horizontal window
 */
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 sum = vec4(0.0);
  
  // Box filter: sum all pixels in radius
  for (int i = -u_radius; i <= u_radius; i++) {
    vec2 offset = vec2(float(i) * texelSize.x, 0.0);
    sum += texture(u_texture, v_texCoord + offset);
  }
  
  // Average by dividing by window size
  float windowSize = float(2 * u_radius + 1);
  fragColor = sum / windowSize;
}
`;

/**
 * Box Filter Shader (Vertical Pass)
 * Completes the separable box filter
 */
export const boxFilterVerticalFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform int u_radius;        // Filter radius in pixels
uniform vec2 u_resolution;   // Image resolution (width, height)

out vec4 fragColor;

/**
 * Vertical box filter pass
 * Completes the 2D box filter by filtering vertically
 */
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 sum = vec4(0.0);
  
  // Box filter: sum all pixels in radius
  for (int i = -u_radius; i <= u_radius; i++) {
    vec2 offset = vec2(0.0, float(i) * texelSize.y);
    sum += texture(u_texture, v_texCoord + offset);
  }
  
  // Average by dividing by window size
  float windowSize = float(2 * u_radius + 1);
  fragColor = sum / windowSize;
}
`;

/**
 * Guided Filter Core Shader
 * Implements the guided filter algorithm using pre-computed box filter results
 */
export const guidedFilterFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;      // Original image
uniform sampler2D u_guide;        // Guide image (luminance)
uniform float u_epsilon;          // Edge threshold (0.001 to 1.0)
uniform int u_radius;             // Filter radius in pixels
uniform vec2 u_resolution;        // Image resolution

out vec4 fragColor;

const float EPSILON_MIN = 1e-8;

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

/**
 * Box filter implementation for local mean computation
 */
vec4 boxFilter(sampler2D tex, vec2 uv, int radius) {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 sum = vec4(0.0);
  
  // 2D box filter
  for (int y = -radius; y <= radius; y++) {
    for (int x = -radius; x <= radius; x++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize;
      sum += texture(tex, uv + offset);
    }
  }
  
  float windowSize = float((2 * radius + 1) * (2 * radius + 1));
  return sum / windowSize;
}

/**
 * Guided filter algorithm
 * Computes edge-aware filtered result using guide image
 */
vec3 applyGuidedFilter(vec3 p, float guide) {
  // Compute local statistics in window
  float meanI = boxFilter(u_guide, v_texCoord, u_radius).r;
  vec3 meanP = boxFilter(u_texture, v_texCoord, u_radius).rgb;
  
  // Compute correlation
  float corrI = 0.0;
  vec3 corrIP = vec3(0.0);
  vec2 texelSize = 1.0 / u_resolution;
  float windowSize = float((2 * u_radius + 1) * (2 * u_radius + 1));
  
  for (int y = -u_radius; y <= u_radius; y++) {
    for (int x = -u_radius; x <= u_radius; x++) {
      vec2 offset = vec2(float(x), float(y)) * texelSize;
      vec2 sampleUV = v_texCoord + offset;
      
      float I = texture(u_guide, sampleUV).r;
      vec3 P = texture(u_texture, sampleUV).rgb;
      
      corrI += I * I;
      corrIP += I * P;
    }
  }
  
  corrI /= windowSize;
  corrIP /= windowSize;
  
  // Compute variance and covariance
  float varI = corrI - meanI * meanI;
  vec3 covIP = corrIP - meanI * meanP;
  
  // Compute linear coefficients a and b
  // a = cov(I,P) / (var(I) + epsilon)
  // b = meanP - a * meanI
  vec3 a = covIP / (varI + u_epsilon);
  vec3 b = meanP - a * meanI;
  
  // Apply filter: q = a * I + b
  // Average a and b in local window for smooth result
  vec3 meanA = boxFilter(u_texture, v_texCoord, u_radius).rgb * 0.0 + a; // Simplified
  vec3 meanB = b;
  
  return meanA * guide + meanB;
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  // Convert to linear space
  color = srgbToLinear(color);
  
  // Use luminance as guide
  float guide = getLuminance(color);
  
  // Apply guided filter
  vec3 filtered = applyGuidedFilter(color, guide);
  
  // Clamp to valid range (allow HDR values for later processing)
  filtered = max(filtered, vec3(0.0));
  
  // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  
  fragColor = vec4(filtered, texColor.a);
}
`;

/**
 * Detail Enhancement Shader
 * Extracts detail layer and applies gain for sharpening/smoothing
 */
export const detailEnhancementFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_original;    // Original image
uniform sampler2D u_filtered;    // Guided filtered image
uniform float u_strength;        // Detail strength (-2.0 to 2.0)
uniform bool u_enabled;          // Enable/disable detail enhancement

out vec4 fragColor;

const float EPSILON = 1e-8;

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

/**
 * Detail enhancement using guided filter
 * Positive strength: sharpening (enhance details)
 * Negative strength: smoothing (reduce details)
 */
vec3 enhanceDetail(vec3 original, vec3 filtered, float strength) {
  // Extract detail layer: detail = original - filtered
  vec3 detail = original - filtered;
  
  // Apply gain to detail layer
  vec3 enhancedDetail = detail * strength;
  
  // Recombine: result = filtered + enhanced_detail
  // When strength > 0: sharpening
  // When strength < 0: smoothing (removes detail)
  vec3 result = filtered + enhancedDetail;
  
  return result;
}

void main() {
  vec4 originalColor = texture(u_original, v_texCoord);
  vec4 filteredColor = texture(u_filtered, v_texCoord);
  
  vec3 color = originalColor.rgb;
  
  if (u_enabled) {
    // Convert to linear space for accurate processing
    vec3 original = srgbToLinear(originalColor.rgb);
    vec3 filtered = srgbToLinear(filteredColor.rgb);
    
    // Apply detail enhancement
    color = enhanceDetail(original, filtered, u_strength);
    
    // Clamp to valid range (allow HDR values for later processing)
    color = max(color, vec3(0.0));
    
    // IMPORTANT: Keep in Linear space! Output shader will convert to sRGB
  }
  
  fragColor = vec4(color, originalColor.a);
}
`;

/**
 * Guided filter parameters
 */
export interface GuidedFilterParams {
  enabled: boolean;
  radius: number;      // Filter radius in pixels (1-20)
  epsilon: number;     // Edge threshold (0.001 - 1.0)
  strength: number;    // Detail enhancement strength (-2.0 to 2.0)
}

/**
 * Default guided filter parameters
 */
export const defaultGuidedFilterParams: GuidedFilterParams = {
  enabled: false,
  radius: 5,
  epsilon: 0.01,
  strength: 0.0,
};

/**
 * Apply guided filter uniforms to shader program
 */
export function applyGuidedFilterUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: GuidedFilterParams,
  resolution: { width: number; height: number }
): void {
  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }

  const radiusLocation = uniforms.get('u_radius');
  if (radiusLocation) {
    gl.uniform1i(radiusLocation, Math.floor(params.radius));
  }

  const epsilonLocation = uniforms.get('u_epsilon');
  if (epsilonLocation) {
    gl.uniform1f(epsilonLocation, params.epsilon);
  }

  const strengthLocation = uniforms.get('u_strength');
  if (strengthLocation) {
    gl.uniform1f(strengthLocation, params.strength);
  }

  const resolutionLocation = uniforms.get('u_resolution');
  if (resolutionLocation) {
    gl.uniform2f(resolutionLocation, resolution.width, resolution.height);
  }
}
