/**
 * Shader Optimization Utilities
 * Provides optimized GLSL functions and shader variants for quality levels
 * Implements task 13.1: Shader optimization
 */

/**
 * Quality levels for shader variants
 */
export type ShaderQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Optimized color space conversion functions
 * Uses built-in GLSL functions and minimizes branching
 */
export const optimizedColorSpaceConversions = `
// Optimized sRGB to Linear conversion (vectorized, no branching)
vec3 srgbToLinear_fast(vec3 srgb) {
  // Use mix() instead of branching for better GPU performance
  vec3 linear = srgb / 12.92;
  vec3 nonlinear = pow((srgb + 0.055) / 1.055, vec3(2.4));
  vec3 cutoff = step(0.04045, srgb);
  return mix(linear, nonlinear, cutoff);
}

// Optimized Linear to sRGB conversion (vectorized, no branching)
vec3 linearToSrgb_fast(vec3 linear) {
  vec3 srgb_linear = linear * 12.92;
  vec3 srgb_nonlinear = 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(0.0031308, linear);
  return mix(srgb_linear, srgb_nonlinear, cutoff);
}

// Fast luminance calculation using built-in dot product
float getLuminance_fast(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

// Fast max/min for chroma calculation
float getChroma_fast(vec3 rgb) {
  return max(max(rgb.r, rgb.g), rgb.b) - min(min(rgb.r, rgb.g), rgb.b);
}
`;

/**
 * Optimized sigmoid curve (reduced texture lookups, uses built-in functions)
 */
export const optimizedSigmoidShader = `
// Optimized sigmoid curve using built-in exp function
float sigmoidCurve_fast(float x, float contrast, float skew, float middleGrey) {
  // Early exit for edge cases (branchless where possible)
  x = clamp(x, 0.0, 1.0);
  
  float x0 = 0.5 + skew * 0.3;
  float k = contrast * 10.0;
  float normalized = x / middleGrey;
  
  // Use built-in exp function (hardware accelerated on most GPUs)
  float sigmoid = 1.0 / (1.0 + exp(-k * (normalized - x0)));
  
  return sigmoid * middleGrey;
}

// Vectorized sigmoid for all channels at once
vec3 applySigmoid_fast(vec3 rgb, float contrast, float skew, float middleGrey) {
  // Process all channels in parallel (SIMD-friendly)
  vec3 clamped = clamp(rgb, vec3(0.0), vec3(1.0));
  float x0 = 0.5 + skew * 0.3;
  float k = contrast * 10.0;
  vec3 normalized = clamped / middleGrey;
  
  vec3 sigmoid = 1.0 / (1.0 + exp(-k * (normalized - x0)));
  return sigmoid * middleGrey;
}
`;

/**
 * Optimized mask generation (reduced branching, vectorized operations)
 */
export const optimizedMaskGeneration = `
// Optimized luminance mask generation using built-in pow and clamp
vec3 generateLuminanceMasks_fast(float Y, float grey, float shadowsWeight, float highlightsWeight) {
  Y = clamp(Y, 0.0, 1.0);
  
  // Use built-in pow function (hardware accelerated)
  float shadows = pow(clamp(1.0 - Y / grey, 0.0, 1.0), shadowsWeight);
  float highlights = pow(clamp((Y - grey) / (1.0 - grey), 0.0, 1.0), highlightsWeight);
  float midtones = max(1.0 - shadows - highlights, 0.0);
  
  return vec3(shadows, midtones, highlights);
}
`;

/**
 * Shader quality presets
 */
export interface ShaderQualityPreset {
  useOptimizedConversions: boolean;
  useFastMath: boolean;
  reducePrecision: boolean;
  skipNonEssentialCalculations: boolean;
  maxIterations: number;
}

export const shaderQualityPresets: Record<ShaderQuality, ShaderQualityPreset> = {
  low: {
    useOptimizedConversions: true,
    useFastMath: true,
    reducePrecision: true,
    skipNonEssentialCalculations: true,
    maxIterations: 2,
  },
  medium: {
    useOptimizedConversions: true,
    useFastMath: true,
    reducePrecision: false,
    skipNonEssentialCalculations: false,
    maxIterations: 3,
  },
  high: {
    useOptimizedConversions: true,
    useFastMath: false,
    reducePrecision: false,
    skipNonEssentialCalculations: false,
    maxIterations: 4,
  },
  ultra: {
    useOptimizedConversions: false,
    useFastMath: false,
    reducePrecision: false,
    skipNonEssentialCalculations: false,
    maxIterations: 5,
  },
};

/**
 * Generate shader variant based on quality level
 */
export function generateShaderVariant(
  baseShader: string,
  quality: ShaderQuality
): string {
  const preset = shaderQualityPresets[quality];
  let shader = baseShader;

  // Replace color space conversions with optimized versions
  if (preset.useOptimizedConversions) {
    shader = shader.replace(/srgbToLinear\(/g, 'srgbToLinear_fast(');
    shader = shader.replace(/linearToSrgb\(/g, 'linearToSrgb_fast(');
    shader = shader.replace(/getLuminance\(/g, 'getLuminance_fast(');
  }

  // Add optimization functions at the beginning
  if (preset.useOptimizedConversions) {
    // Insert after precision declaration
    const precisionIndex = shader.indexOf('precision');
    const insertIndex = shader.indexOf('\n', precisionIndex) + 1;
    shader = shader.slice(0, insertIndex) + 
             '\n' + optimizedColorSpaceConversions + '\n' +
             shader.slice(insertIndex);
  }

  return shader;
}

/**
 * Texture sampling optimization hints
 */
export const textureSamplingOptimizations = `
// Cache texture lookups to avoid redundant sampling
// Use this pattern:
// vec4 texColor = texture(u_texture, v_texCoord);
// vec3 color = texColor.rgb;
// float alpha = texColor.a;
// Instead of multiple texture() calls

// For multi-pass operations, prefer:
// - Single texture lookup per fragment
// - Reuse sampled values
// - Avoid dependent texture reads when possible
`;

/**
 * Branching optimization guidelines
 */
export const branchingOptimizations = `
// Minimize branching in shaders:
// 1. Use mix() instead of if/else for simple conditions
// 2. Use step() and smoothstep() for threshold operations
// 3. Use built-in functions (clamp, min, max) instead of conditionals
// 4. Prefer uniform branches over varying branches
// 5. Keep branches uniform across all fragments when possible

// Example: Replace this:
// if (x < threshold) {
//   result = a;
// } else {
//   result = b;
// }
// With this:
// result = mix(b, a, step(x, threshold));
`;

/**
 * Built-in function usage guidelines
 */
export const builtInFunctionOptimizations = `
// Prefer built-in GLSL functions (hardware accelerated):
// - Use dot() for vector dot products
// - Use length() for vector magnitude
// - Use normalize() for vector normalization
// - Use mix() for linear interpolation
// - Use smoothstep() for smooth transitions
// - Use clamp() for range limiting
// - Use pow() for exponentiation
// - Use exp() and log() for exponential/logarithmic operations
// - Use sin(), cos(), tan() for trigonometry
// - Use atan() for arctangent (prefer atan(y, x) over atan(y/x))
// - Use abs(), sign(), floor(), ceil(), fract() for scalar operations
// - Use min(), max() for comparisons
// - Use step() for threshold operations
`;

/**
 * Memory access optimization guidelines
 */
export const memoryAccessOptimizations = `
// Optimize memory access patterns:
// 1. Minimize texture lookups (cache results)
// 2. Use texture atlases to reduce texture switches
// 3. Prefer sequential memory access
// 4. Use appropriate texture formats (RGBA16F vs RGBA32F)
// 5. Avoid random access patterns
// 6. Use mipmaps for downsampled textures
// 7. Prefer uniform buffer objects for large constant data
`;

/**
 * Precision optimization guidelines
 */
export const precisionOptimizations = `
// Use appropriate precision qualifiers:
// - highp: Full 32-bit precision (use for positions, coordinates)
// - mediump: 16-bit precision (use for colors, normals)
// - lowp: 10-bit precision (use for simple flags, masks)

// Example:
// highp vec2 position;
// mediump vec3 color;
// lowp float mask;

// Note: Mobile GPUs benefit more from lower precision
// Desktop GPUs often ignore precision qualifiers
`;

/**
 * Get optimization report for a shader
 */
export function analyzeShaderOptimizations(shaderSource: string): {
  textureLookupsCount: number;
  branchingCount: number;
  builtInFunctionsCount: number;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  
  // Count texture lookups
  const textureLookupsCount = (shaderSource.match(/texture\(/g) || []).length;
  if (textureLookupsCount > 3) {
    suggestions.push(`High texture lookup count (${textureLookupsCount}). Consider caching results.`);
  }
  
  // Count branching statements
  const branchingCount = 
    (shaderSource.match(/\bif\s*\(/g) || []).length +
    (shaderSource.match(/\bfor\s*\(/g) || []).length +
    (shaderSource.match(/\bwhile\s*\(/g) || []).length;
  if (branchingCount > 5) {
    suggestions.push(`High branching count (${branchingCount}). Consider using mix() or step() instead.`);
  }
  
  // Count built-in function usage
  const builtInFunctions = [
    'dot', 'length', 'normalize', 'mix', 'smoothstep', 'clamp',
    'pow', 'exp', 'log', 'sin', 'cos', 'tan', 'atan',
    'abs', 'sign', 'floor', 'ceil', 'fract', 'min', 'max', 'step'
  ];
  let builtInFunctionsCount = 0;
  for (const func of builtInFunctions) {
    const regex = new RegExp(`\\b${func}\\s*\\(`, 'g');
    builtInFunctionsCount += (shaderSource.match(regex) || []).length;
  }
  
  // Check for manual implementations that could use built-ins
  if (shaderSource.includes('sqrt(x*x + y*y)')) {
    suggestions.push('Use length(vec2(x, y)) instead of manual distance calculation.');
  }
  
  if (shaderSource.includes('/ sqrt(')) {
    suggestions.push('Consider using normalize() for vector normalization.');
  }
  
  return {
    textureLookupsCount,
    branchingCount,
    builtInFunctionsCount,
    suggestions,
  };
}

/**
 * Generate performance-optimized shader header
 */
export function generateOptimizedShaderHeader(quality: ShaderQuality): string {
  const preset = shaderQualityPresets[quality];
  
  let header = `#version 300 es\n`;
  
  // Set precision based on quality
  if (preset.reducePrecision) {
    header += `precision mediump float;\n`;
  } else {
    header += `precision highp float;\n`;
  }
  
  // Add optimization defines
  header += `\n// Shader Quality: ${quality.toUpperCase()}\n`;
  header += `#define USE_OPTIMIZED_CONVERSIONS ${preset.useOptimizedConversions ? '1' : '0'}\n`;
  header += `#define USE_FAST_MATH ${preset.useFastMath ? '1' : '0'}\n`;
  header += `#define MAX_ITERATIONS ${preset.maxIterations}\n`;
  header += `\n`;
  
  return header;
}
