/**
 * Local Laplacian Filter Shader
 * Implements simplified local Laplacian pyramid for multi-scale local contrast enhancement
 * Based on "Local Laplacian Filters: Edge-aware Image Processing with a Laplacian Pyramid" (2011)
 * Simplified version using 3-4 pyramid levels for real-time performance
 */

export const localLaplacianVertexShader = `#version 300 es
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
 * Gaussian Blur Shader (Horizontal Pass)
 * Implements separable 5x5 Gaussian blur for pyramid downsampling
 */
export const gaussianBlurHorizontalFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;   // Image resolution (width, height)

out vec4 fragColor;

// 5-tap Gaussian kernel weights (sigma ≈ 1.0)
// Normalized: [0.06136, 0.24477, 0.38774, 0.24477, 0.06136]
const float weights[5] = float[5](0.06136, 0.24477, 0.38774, 0.24477, 0.06136);
const int radius = 2;

/**
 * Horizontal Gaussian blur pass
 * Uses separable filter for efficiency
 */
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 sum = vec4(0.0);
  
  // Apply Gaussian kernel horizontally
  for (int i = -radius; i <= radius; i++) {
    vec2 offset = vec2(float(i) * texelSize.x, 0.0);
    sum += texture(u_texture, v_texCoord + offset) * weights[i + radius];
  }
  
  fragColor = sum;
}
`;

/**
 * Gaussian Blur Shader (Vertical Pass)
 * Completes the separable 5x5 Gaussian blur
 */
export const gaussianBlurVerticalFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;   // Image resolution (width, height)

out vec4 fragColor;

// 5-tap Gaussian kernel weights (sigma ≈ 1.0)
const float weights[5] = float[5](0.06136, 0.24477, 0.38774, 0.24477, 0.06136);
const int radius = 2;

/**
 * Vertical Gaussian blur pass
 * Completes the 2D Gaussian blur
 */
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 sum = vec4(0.0);
  
  // Apply Gaussian kernel vertically
  for (int i = -radius; i <= radius; i++) {
    vec2 offset = vec2(0.0, float(i) * texelSize.y);
    sum += texture(u_texture, v_texCoord + offset) * weights[i + radius];
  }
  
  fragColor = sum;
}
`;

/**
 * Downsample Shader
 * Downsamples image by 2x with Gaussian blur for pyramid construction
 */
export const downsampleFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_resolution;   // Source resolution (width, height)

out vec4 fragColor;

/**
 * Downsample with 2x2 box filter
 * Samples at half-pixel offsets for better quality
 */
void main() {
  vec2 texelSize = 1.0 / u_resolution;
  
  // Sample 2x2 neighborhood at half-pixel offsets
  vec4 sum = vec4(0.0);
  sum += texture(u_texture, v_texCoord + vec2(-0.25, -0.25) * texelSize);
  sum += texture(u_texture, v_texCoord + vec2( 0.25, -0.25) * texelSize);
  sum += texture(u_texture, v_texCoord + vec2(-0.25,  0.25) * texelSize);
  sum += texture(u_texture, v_texCoord + vec2( 0.25,  0.25) * texelSize);
  
  fragColor = sum * 0.25;
}
`;

/**
 * Upsample Shader
 * Upsamples image by 2x with bilinear interpolation
 */
export const upsampleFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform vec2 u_sourceResolution;  // Source (smaller) resolution
uniform vec2 u_targetResolution;  // Target (larger) resolution

out vec4 fragColor;

/**
 * Upsample with bilinear interpolation
 * Maps target coordinates to source texture
 */
void main() {
  // Calculate source UV coordinates
  vec2 sourceUV = v_texCoord * (u_targetResolution / u_sourceResolution);
  
  // Sample with bilinear filtering (handled by texture sampler)
  fragColor = texture(u_texture, sourceUV);
}
`;

/**
 * Laplacian Computation Shader
 * Computes Laplacian (high-frequency detail) by subtracting upsampled coarser level from current level
 */
export const laplacianFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_currentLevel;   // Current pyramid level
uniform sampler2D u_coarserLevel;   // Coarser (blurred/downsampled) level
uniform vec2 u_resolution;          // Current level resolution

out vec4 fragColor;

/**
 * Compute Laplacian detail layer
 * Laplacian = Current - Upsampled(Coarser)
 * Stores high-frequency details at this scale
 */
void main() {
  // Sample current level
  vec4 current = texture(u_currentLevel, v_texCoord);
  
  // Sample upsampled coarser level
  vec4 coarser = texture(u_coarserLevel, v_texCoord);
  
  // Compute difference (high-frequency detail)
  vec4 laplacian = current - coarser;
  
  // Store as signed values (0.5 = zero, <0.5 = negative, >0.5 = positive)
  // This allows us to store negative values in texture
  fragColor = laplacian + 0.5;
}
`;

/**
 * Laplacian Decode Shader
 * Decodes stored Laplacian values back to signed range
 */
export const laplacianDecodeFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_laplacian;

out vec4 fragColor;

/**
 * Decode Laplacian from storage format
 * Converts from [0, 1] range to signed range
 */
void main() {
  vec4 encoded = texture(u_laplacian, v_texCoord);
  
  // Decode: subtract 0.5 to get signed values
  fragColor = encoded - 0.5;
}
`;

/**
 * Laplacian Gain Shader
 * Applies per-level gain to Laplacian detail layers
 * Supports both enhancement (positive gain) and smoothing (negative gain)
 */
export const laplacianGainFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_laplacian;   // Laplacian detail layer (encoded)
uniform float u_gain;            // Gain multiplier for this level
uniform int u_level;             // Pyramid level (0 = finest, 3 = coarsest)

out vec4 fragColor;

/**
 * Apply gain to Laplacian detail layer
 * Positive gain: enhance details
 * Negative gain: smooth/reduce details
 */
void main() {
  // Decode Laplacian from storage format
  vec4 encoded = texture(u_laplacian, v_texCoord);
  vec4 detail = encoded - 0.5;
  
  // Apply gain
  vec4 enhanced = detail * u_gain;
  
  // Re-encode for storage
  fragColor = enhanced + 0.5;
}
`;

/**
 * Pyramid Reconstruction Shader
 * Reconstructs image from Laplacian pyramid by upsampling and adding detail layers
 */
export const pyramidReconstructFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_coarserLevel;   // Coarser reconstructed level (upsampled)
uniform sampler2D u_laplacian;      // Laplacian detail at current level (encoded)
uniform vec2 u_resolution;          // Current level resolution

out vec4 fragColor;

/**
 * Reconstruct pyramid level
 * Result = Upsampled(Coarser) + Laplacian(Current)
 * Combines low-frequency structure with high-frequency details
 */
void main() {
  // Sample upsampled coarser level (low frequencies)
  vec4 coarser = texture(u_coarserLevel, v_texCoord);
  
  // Sample and decode Laplacian detail (high frequencies)
  vec4 encoded = texture(u_laplacian, v_texCoord);
  vec4 detail = encoded - 0.5;
  
  // Reconstruct by adding detail to coarser level
  vec4 reconstructed = coarser + detail;
  
  // Clamp to valid range
  fragColor = clamp(reconstructed, 0.0, 1.0);
}
`;

/**
 * Local Laplacian Main Shader
 * Applies local Laplacian filtering with multi-scale contrast control
 */
export const localLaplacianFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enabled;
uniform float u_detail;      // Fine detail control (-1.0 to 1.0)
uniform float u_coarse;      // Coarse structure control (-1.0 to 1.0)
uniform float u_strength;    // Overall strength (0.0 to 2.0)

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

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (!u_enabled) {
    fragColor = texColor;
    return;
  }
  
  // Note: This is a simplified placeholder
  // Full implementation requires multi-pass rendering with pyramid construction
  // This will be handled by the pipeline manager
  
  fragColor = texColor;
}
`;


/**
 * Local Laplacian parameters
 */
export interface LocalLaplacianParams {
  enabled: boolean;
  detail: number;      // Fine detail enhancement (-1.0 to 1.0)
  coarse: number;      // Coarse structure enhancement (-1.0 to 1.0)
  strength: number;    // Overall strength multiplier (0.0 to 2.0)
  levels: number;      // Number of pyramid levels (3 or 4)
}

/**
 * Default Local Laplacian parameters
 */
export const defaultLocalLaplacianParams: LocalLaplacianParams = {
  enabled: false,
  detail: 0.0,
  coarse: 0.0,
  strength: 1.0,
  levels: 4,
};

/**
 * Calculate per-level gains from user controls
 * Maps user-friendly controls (detail, coarse) to per-level gains
 * 
 * @param params Local Laplacian parameters
 * @returns Array of gain values for each pyramid level [finest -> coarsest]
 */
export function calculateLevelGains(params: LocalLaplacianParams): number[] {
  const { detail, coarse, strength, levels } = params;
  const gains: number[] = [];
  
  for (let i = 0; i < levels; i++) {
    // Level 0 = finest detail, Level (levels-1) = coarsest structure
    const t = i / (levels - 1); // 0.0 to 1.0
    
    // Interpolate between detail (fine) and coarse (structure) controls
    // Fine levels get more detail influence, coarse levels get more structure influence
    const gain = detail * (1.0 - t) + coarse * t;
    
    // Apply overall strength multiplier
    gains.push(1.0 + gain * strength);
  }
  
  return gains;
}

/**
 * Apply Local Laplacian uniforms to shader program
 */
export function applyLocalLaplacianUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: LocalLaplacianParams
): void {
  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }

  const detailLocation = uniforms.get('u_detail');
  if (detailLocation) {
    gl.uniform1f(detailLocation, params.detail);
  }

  const coarseLocation = uniforms.get('u_coarse');
  if (coarseLocation) {
    gl.uniform1f(coarseLocation, params.coarse);
  }

  const strengthLocation = uniforms.get('u_strength');
  if (strengthLocation) {
    gl.uniform1f(strengthLocation, params.strength);
  }
}

/**
 * Calculate pyramid level dimensions
 * Each level is half the size of the previous level
 */
export function calculatePyramidDimensions(
  baseWidth: number,
  baseHeight: number,
  levels: number
): Array<{ width: number; height: number }> {
  const dimensions: Array<{ width: number; height: number }> = [];
  
  let width = baseWidth;
  let height = baseHeight;
  
  for (let i = 0; i < levels; i++) {
    dimensions.push({ width, height });
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
  
  return dimensions;
}
