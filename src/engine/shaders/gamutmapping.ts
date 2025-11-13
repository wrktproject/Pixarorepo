/**
 * Gamut Mapping Shader
 * Implements perceptual gamut compression with hue preservation
 * Maps out-of-gamut colors to displayable range while maintaining color relationships
 * Based on Darktable's gamut mapping algorithms
 */

export const gamutMappingVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const gamutMappingFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enabled;

// Gamut mapping parameters
uniform int u_targetGamut;        // 0: sRGB, 1: Display P3, 2: Rec2020
uniform int u_mappingMethod;      // 0: perceptual, 1: saturation, 2: relative colorimetric
uniform float u_compressionAmount; // 0.0 to 1.0 (amount of soft compression)

out vec4 fragColor;

const float EPSILON = 1e-8;
const float PI = 3.14159265359;

// Gamut constants
const int GAMUT_SRGB = 0;
const int GAMUT_DISPLAY_P3 = 1;
const int GAMUT_REC2020 = 2;

// Mapping method constants
const int METHOD_PERCEPTUAL = 0;
const int METHOD_SATURATION = 1;
const int METHOD_RELATIVE = 2;

// ============================================================================
// Color Space Conversions
// ============================================================================

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
 * Convert Linear RGB to XYZ (D50)
 */
vec3 linearRGBToXYZ_D50(vec3 rgb) {
  // First convert to XYZ D65
  mat3 rgbToXYZ_D65 = mat3(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );
  vec3 xyzD65 = rgbToXYZ_D65 * rgb;
  
  // Bradford adaptation from D65 to D50
  mat3 bradfordD65toD50 = mat3(
     1.0478112,  0.0228866, -0.0501270,
     0.0295424,  0.9904844, -0.0170491,
    -0.0092345,  0.0150436,  0.7521316
  );
  
  return bradfordD65toD50 * xyzD65;
}

/**
 * Convert XYZ (D50) to Linear RGB
 */
vec3 xyzD50ToLinearRGB(vec3 xyz) {
  // Bradford adaptation from D50 to D65
  mat3 bradfordD50toD65 = mat3(
     0.9555766, -0.0230393,  0.0631636,
    -0.0282895,  1.0099416,  0.0210077,
     0.0122982, -0.0204830,  1.3299098
  );
  
  vec3 xyzD65 = bradfordD50toD65 * xyz;
  
  // Convert XYZ D65 to Linear RGB
  mat3 xyzToRGB_D65 = mat3(
     3.2404542, -1.5371385, -0.4985314,
    -0.9692660,  1.8760108,  0.0415560,
     0.0556434, -0.2040259,  1.0572252
  );
  
  return xyzToRGB_D65 * xyzD65;
}

// ============================================================================
// Lab Color Space (D50)
// ============================================================================

/**
 * Lab f function for XYZ to Lab conversion
 */
float labF(float t) {
  const float delta = 6.0 / 29.0;
  const float delta3 = delta * delta * delta;
  
  if (t > delta3) {
    return pow(t, 1.0 / 3.0);
  } else {
    return t / (3.0 * delta * delta) + 4.0 / 29.0;
  }
}

/**
 * Inverse Lab f function for Lab to XYZ conversion
 */
float labFInv(float t) {
  const float delta = 6.0 / 29.0;
  
  if (t > delta) {
    return t * t * t;
  } else {
    return 3.0 * delta * delta * (t - 4.0 / 29.0);
  }
}

/**
 * Convert XYZ (D50) to Lab
 */
vec3 xyzD50ToLab(vec3 xyz) {
  // D50 white point
  const vec3 whitePoint = vec3(0.9642, 1.0000, 0.8249);
  
  vec3 f;
  f.x = labF(xyz.x / whitePoint.x);
  f.y = labF(xyz.y / whitePoint.y);
  f.z = labF(xyz.z / whitePoint.z);
  
  float L = 116.0 * f.y - 16.0;
  float a = 500.0 * (f.x - f.y);
  float b = 200.0 * (f.y - f.z);
  
  return vec3(L, a, b);
}

/**
 * Convert Lab to XYZ (D50)
 */
vec3 labToXYZ_D50(vec3 lab) {
  // D50 white point
  const vec3 whitePoint = vec3(0.9642, 1.0000, 0.8249);
  
  float fy = (lab.x + 16.0) / 116.0;
  float fx = lab.y / 500.0 + fy;
  float fz = fy - lab.z / 200.0;
  
  vec3 xyz;
  xyz.x = whitePoint.x * labFInv(fx);
  xyz.y = whitePoint.y * labFInv(fy);
  xyz.z = whitePoint.z * labFInv(fz);
  
  return xyz;
}

/**
 * Convert Linear RGB to Lab
 */
vec3 linearRGBToLab(vec3 rgb) {
  vec3 xyz = linearRGBToXYZ_D50(rgb);
  return xyzD50ToLab(xyz);
}

/**
 * Convert Lab to Linear RGB
 */
vec3 labToLinearRGB(vec3 lab) {
  vec3 xyz = labToXYZ_D50(lab);
  return xyzD50ToLinearRGB(xyz);
}

// ============================================================================
// LCH Color Space (Lightness, Chroma, Hue)
// ============================================================================

/**
 * Convert Lab to LCH
 * L: Lightness [0-100]
 * C: Chroma [0-~180]
 * H: Hue angle [0-2π radians]
 */
vec3 labToLCH(vec3 lab) {
  float L = lab.x;
  float C = sqrt(lab.y * lab.y + lab.z * lab.z);
  float H = atan(lab.z, lab.y);
  
  return vec3(L, C, H);
}

/**
 * Convert LCH to Lab
 */
vec3 lchToLab(vec3 lch) {
  float L = lch.x;
  float a = lch.y * cos(lch.z);
  float b = lch.y * sin(lch.z);
  
  return vec3(L, a, b);
}

/**
 * Convert Linear RGB to LCH
 */
vec3 linearRGBToLCH(vec3 rgb) {
  vec3 lab = linearRGBToLab(rgb);
  return labToLCH(lab);
}

/**
 * Convert LCH to Linear RGB
 */
vec3 lchToLinearRGB(vec3 lch) {
  vec3 lab = lchToLab(lch);
  return labToLinearRGB(lab);
}

// ============================================================================
// Gamut Detection
// ============================================================================

/**
 * Check if a linear RGB color is within sRGB gamut
 * Returns true if all channels are in [0, 1] range
 */
bool isInSRGBGamut(vec3 rgb) {
  return rgb.r >= 0.0 && rgb.r <= 1.0 &&
         rgb.g >= 0.0 && rgb.g <= 1.0 &&
         rgb.b >= 0.0 && rgb.b <= 1.0;
}

/**
 * Check if a linear RGB color is within Display P3 gamut
 * Display P3 has wider gamut than sRGB
 */
bool isInDisplayP3Gamut(vec3 rgb) {
  // Convert to Display P3 color space
  // For simplicity, we use an approximation based on the wider primaries
  // Display P3 can represent colors outside sRGB, so we check a wider range
  
  // Display P3 to XYZ matrix (D65)
  mat3 p3ToXYZ = mat3(
    0.4865709, 0.2656677, 0.1982173,
    0.2289746, 0.6917385, 0.0792869,
    0.0000000, 0.0451134, 1.0439444
  );
  
  vec3 xyz = p3ToXYZ * rgb;
  
  // Check if XYZ values are reasonable (positive and not too large)
  return xyz.x >= 0.0 && xyz.y >= 0.0 && xyz.z >= 0.0 &&
         xyz.x <= 2.0 && xyz.y <= 2.0 && xyz.z <= 2.0;
}

/**
 * Check if a linear RGB color is within Rec2020 gamut
 * Rec2020 has the widest gamut
 */
bool isInRec2020Gamut(vec3 rgb) {
  // Rec2020 has very wide gamut, most colors will be in range
  // Check for reasonable bounds
  return rgb.r >= -0.1 && rgb.r <= 1.1 &&
         rgb.g >= -0.1 && rgb.g <= 1.1 &&
         rgb.b >= -0.1 && rgb.b <= 1.1;
}

/**
 * Get maximum chroma for a given lightness and hue in target gamut
 * This is a simplified approximation - a full implementation would use a LUT
 */
float getMaxChroma(float L, float H, int targetGamut) {
  // Approximate maximum chroma based on lightness
  // Chroma is typically highest at mid-lightness and decreases toward black/white
  
  float maxChromaAtMidL = 0.0;
  
  if (targetGamut == GAMUT_SRGB) {
    maxChromaAtMidL = 130.0; // Approximate max chroma for sRGB
  } else if (targetGamut == GAMUT_DISPLAY_P3) {
    maxChromaAtMidL = 150.0; // Display P3 has wider gamut
  } else if (targetGamut == GAMUT_REC2020) {
    maxChromaAtMidL = 180.0; // Rec2020 has widest gamut
  }
  
  // Chroma decreases toward black (L=0) and white (L=100)
  float lightnessScale = 1.0 - pow(abs(L - 50.0) / 50.0, 1.5);
  
  // Hue-dependent adjustment (some hues have wider gamut than others)
  // Blue and cyan typically have wider gamut than red/yellow
  float hueDegrees = degrees(H);
  if (hueDegrees < 0.0) hueDegrees += 360.0;
  
  float hueScale = 1.0;
  if (hueDegrees >= 180.0 && hueDegrees <= 270.0) {
    // Blue-cyan region has wider gamut
    hueScale = 1.2;
  } else if (hueDegrees >= 0.0 && hueDegrees <= 60.0) {
    // Red-yellow region has narrower gamut
    hueScale = 0.9;
  }
  
  return maxChromaAtMidL * lightnessScale * hueScale;
}

// ============================================================================
// Gamut Compression Methods
// ============================================================================

/**
 * Perceptual gamut compression
 * Uses soft compression curve to smoothly bring out-of-gamut colors into range
 * Preserves hue as primary priority
 */
vec3 perceptualGamutCompression(vec3 lch, int targetGamut, float compressionAmount) {
  float L = lch.x;
  float C = lch.y;
  float H = lch.z;
  
  // Get maximum chroma for this lightness and hue
  float maxChroma = getMaxChroma(L, H, targetGamut);
  
  // If chroma is within gamut, no compression needed
  if (C <= maxChroma) {
    return lch;
  }
  
  // Apply soft compression using smooth curve
  // This avoids hard clipping and maintains smooth gradients
  float ratio = maxChroma / (C + EPSILON);
  
  // Soft compression curve: exponential rolloff
  // compressionAmount controls how aggressive the compression is
  float compressionStrength = mix(0.5, 1.0, compressionAmount);
  float compressedC = maxChroma * (1.0 - exp(-C / maxChroma * compressionStrength));
  
  // Blend between original and compressed based on how far out of gamut
  float outOfGamutAmount = clamp((C - maxChroma) / maxChroma, 0.0, 1.0);
  float finalC = mix(C, compressedC, outOfGamutAmount);
  
  return vec3(L, finalC, H);
}

/**
 * Saturation mapping method
 * Reduces saturation uniformly to bring color into gamut
 * Simpler but less perceptually accurate than perceptual method
 */
vec3 saturationGamutMapping(vec3 lch, int targetGamut) {
  float L = lch.x;
  float C = lch.y;
  float H = lch.z;
  
  // Get maximum chroma for this lightness and hue
  float maxChroma = getMaxChroma(L, H, targetGamut);
  
  // If chroma is within gamut, no mapping needed
  if (C <= maxChroma) {
    return lch;
  }
  
  // Simple linear reduction to max chroma
  float newC = maxChroma;
  
  return vec3(L, newC, H);
}

/**
 * Relative colorimetric mapping
 * Clips out-of-gamut colors to gamut boundary
 * Maintains white point but may cause posterization
 */
vec3 relativeColorimetricMapping(vec3 rgb) {
  // Simple clipping to [0, 1] range
  return clamp(rgb, 0.0, 1.0);
}

// ============================================================================
// Main Gamut Mapping Function
// ============================================================================

vec3 applyGamutMapping(vec3 rgb) {
  // Convert to linear space
  rgb = srgbToLinear(rgb);
  
  // Check if color is already in gamut
  bool inGamut = false;
  if (u_targetGamut == GAMUT_SRGB) {
    inGamut = isInSRGBGamut(rgb);
  } else if (u_targetGamut == GAMUT_DISPLAY_P3) {
    inGamut = isInDisplayP3Gamut(rgb);
  } else if (u_targetGamut == GAMUT_REC2020) {
    inGamut = isInRec2020Gamut(rgb);
  }
  
  // If already in gamut, no mapping needed
  if (inGamut && u_mappingMethod != METHOD_RELATIVE) {
    return linearToSrgb(rgb);
  }
  
  // Apply gamut mapping based on selected method
  vec3 mappedRGB = rgb;
  
  if (u_mappingMethod == METHOD_PERCEPTUAL) {
    // Convert to LCH for perceptual mapping
    vec3 lch = linearRGBToLCH(rgb);
    
    // Apply perceptual compression
    lch = perceptualGamutCompression(lch, u_targetGamut, u_compressionAmount);
    
    // Convert back to RGB
    mappedRGB = lchToLinearRGB(lch);
    
    // Final safety clamp
    mappedRGB = clamp(mappedRGB, 0.0, 1.0);
    
  } else if (u_mappingMethod == METHOD_SATURATION) {
    // Convert to LCH for saturation mapping
    vec3 lch = linearRGBToLCH(rgb);
    
    // Apply saturation mapping
    lch = saturationGamutMapping(lch, u_targetGamut);
    
    // Convert back to RGB
    mappedRGB = lchToLinearRGB(lch);
    
    // Final safety clamp
    mappedRGB = clamp(mappedRGB, 0.0, 1.0);
    
  } else if (u_mappingMethod == METHOD_RELATIVE) {
    // Simple clipping
    mappedRGB = relativeColorimetricMapping(rgb);
  }
  
  // Convert back to sRGB for display
  return linearToSrgb(mappedRGB);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    color = applyGamutMapping(color);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Gamut mapping parameters
 */
export interface GamutMappingParams {
  enabled: boolean;
  targetGamut: 'sRGB' | 'Display P3' | 'Rec2020';
  mappingMethod: 'perceptual' | 'saturation' | 'relative';
  compressionAmount: number; // 0.0 to 1.0 (for perceptual method)
}

/**
 * Default gamut mapping parameters
 */
export const defaultGamutMappingParams: GamutMappingParams = {
  enabled: false,
  targetGamut: 'sRGB',
  mappingMethod: 'perceptual',
  compressionAmount: 0.8,
};

/**
 * Apply gamut mapping uniforms to shader program
 */
export function applyGamutMappingUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: GamutMappingParams
): void {
  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }

  const targetGamutLocation = uniforms.get('u_targetGamut');
  if (targetGamutLocation) {
    const gamutValue = params.targetGamut === 'sRGB' ? 0 : 
                       params.targetGamut === 'Display P3' ? 1 : 2;
    gl.uniform1i(targetGamutLocation, gamutValue);
  }

  const mappingMethodLocation = uniforms.get('u_mappingMethod');
  if (mappingMethodLocation) {
    const methodValue = params.mappingMethod === 'perceptual' ? 0 :
                        params.mappingMethod === 'saturation' ? 1 : 2;
    gl.uniform1i(mappingMethodLocation, methodValue);
  }

  const compressionAmountLocation = uniforms.get('u_compressionAmount');
  if (compressionAmountLocation) {
    gl.uniform1f(compressionAmountLocation, params.compressionAmount);
  }
}
