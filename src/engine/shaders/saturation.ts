/**
 * Perceptual Saturation and Vibrance Shader
 * Implements global saturation and vibrance in perceptually uniform color space
 * Uses JzAzBz color space for accurate perceptual adjustments
 * Based on Darktable's saturation module
 */

export const saturationVertexShader = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
  v_texCoord = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const saturationFragmentShader = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_texture;
uniform bool u_enabled;

// Saturation parameters
uniform float u_saturation;           // Global saturation (-1.0 to 1.0)
uniform float u_vibrance;             // Adaptive saturation (-1.0 to 1.0)
uniform bool u_skinToneProtection;    // Enable skin tone protection
uniform float u_skinProtectionStrength; // Skin tone protection strength (0.0 to 1.0)

out vec4 fragColor;

const float EPSILON = 1e-8;
const float PI = 3.14159265359;

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

// Calculate luminance using Rec. 709 coefficients
float getLuminance(vec3 rgb) {
  return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

// ============================================================================
// JzAzBz Color Space (Perceptually Uniform, HDR-capable)
// ============================================================================

/**
 * Convert Linear RGB to XYZ (D65)
 */
vec3 linearRGBToXYZ_D65(vec3 rgb) {
  mat3 matrix = mat3(
    0.4124564, 0.3575761, 0.1804375,
    0.2126729, 0.7151522, 0.0721750,
    0.0193339, 0.1191920, 0.9503041
  );
  return matrix * rgb;
}

/**
 * Convert XYZ (D65) to Linear RGB
 */
vec3 xyzD65ToLinearRGB(vec3 xyz) {
  mat3 matrix = mat3(
     3.2404542, -1.5371385, -0.4985314,
    -0.9692660,  1.8760108,  0.0415560,
     0.0556434, -0.2040259,  1.0572252
  );
  return matrix * xyz;
}

/**
 * PQ (Perceptual Quantizer) transfer function
 * Used in JzAzBz for perceptual uniformity
 */
float pqEncode(float x) {
  const float m1 = 0.1593017578125;
  const float m2 = 78.84375;
  const float c1 = 0.8359375;
  const float c2 = 18.8515625;
  const float c3 = 18.6875;
  
  float xPow = pow(max(x, 0.0), m1);
  return pow((c1 + c2 * xPow) / (1.0 + c3 * xPow), m2);
}

/**
 * Inverse PQ transfer function
 */
float pqDecode(float x) {
  const float m1 = 0.1593017578125;
  const float m2 = 78.84375;
  const float c1 = 0.8359375;
  const float c2 = 18.8515625;
  const float c3 = 18.6875;
  
  float xPow = pow(max(x, 0.0), 1.0 / m2);
  return pow(max((xPow - c1) / (c2 - c3 * xPow), 0.0), 1.0 / m1);
}

/**
 * Convert Linear RGB to JzAzBz
 * Jz: Perceptual lightness (0 to ~0.17 for SDR)
 * Az: Red-Green opponent axis
 * Bz: Yellow-Blue opponent axis
 */
vec3 linearRGBToJzAzBz(vec3 rgb) {
  // Clamp to prevent negative values
  rgb = max(rgb, vec3(0.0));
  
  // Convert to XYZ D65
  vec3 xyz = linearRGBToXYZ_D65(rgb);
  
  // Convert to LMS (cone response)
  mat3 xyzToLMS = mat3(
     0.41478972,  0.579999,   0.0146480,
    -0.2015100,   1.120649,   0.0531008,
    -0.0166008,   0.264800,   0.6684799
  );
  vec3 lms = xyzToLMS * xyz;
  
  // Apply PQ encoding
  vec3 lmsPQ;
  lmsPQ.x = pqEncode(lms.x);
  lmsPQ.y = pqEncode(lms.y);
  lmsPQ.z = pqEncode(lms.z);
  
  // Convert to Izazbz
  mat3 lmsToIzazbz = mat3(
     0.5,       0.5,       0.0,
     3.524000, -4.066708,  0.542708,
     0.199076,  1.096799, -1.295875
  );
  vec3 izazbz = lmsToIzazbz * lmsPQ;
  
  // Calculate Jz from Iz
  float Jz = (0.44 * izazbz.x) / (1.0 - 0.56 * izazbz.x);
  
  return vec3(Jz, izazbz.y, izazbz.z);
}

/**
 * Convert JzAzBz to Linear RGB
 */
vec3 jzAzBzToLinearRGB(vec3 jab) {
  float Jz = jab.x;
  float Az = jab.y;
  float Bz = jab.z;
  
  // Calculate Iz from Jz
  float Iz = Jz / (0.44 + 0.56 * Jz);
  
  // Convert from Izazbz to LMS PQ
  mat3 izazbzToLMS = mat3(
     1.0,            0.1386050,  0.0580473,
     1.0,           -0.1386050, -0.0580473,
     1.0,           -0.0960192, -0.8118918
  );
  vec3 lmsPQ = izazbzToLMS * vec3(Iz, Az, Bz);
  
  // Apply inverse PQ
  vec3 lms;
  lms.x = pqDecode(lmsPQ.x);
  lms.y = pqDecode(lmsPQ.y);
  lms.z = pqDecode(lmsPQ.z);
  
  // Convert LMS to XYZ
  mat3 lmsToXYZ = mat3(
     1.9242264,  -1.0047923,  0.0376514,
     0.3503167,   0.7264811, -0.0653844,
    -0.0909828,  -0.3127282,  1.5227665
  );
  vec3 xyz = lmsToXYZ * lms;
  
  // Convert XYZ to Linear RGB
  return xyzD65ToLinearRGB(xyz);
}

// ============================================================================
// Saturation and Vibrance Functions
// ============================================================================

/**
 * Apply global saturation in perceptual space
 * Maintains luminance while scaling chroma
 * 
 * @param jab Color in JzAzBz space
 * @param saturation Saturation amount (-1.0 to 1.0)
 * @return Adjusted color in JzAzBz
 */
vec3 applyGlobalSaturation(vec3 jab, float saturation) {
  float Jz = jab.x;
  float Az = jab.y;
  float Bz = jab.z;
  
  // Calculate chroma
  float C = sqrt(Az * Az + Bz * Bz);
  
  // Calculate hue angle
  float H = atan(Bz, Az);
  
  // Apply saturation (multiplicative for perceptual uniformity)
  float saturationMultiplier = 1.0 + saturation;
  float newC = C * saturationMultiplier;
  
  // Reconstruct Az, Bz from new chroma
  float newAz = newC * cos(H);
  float newBz = newC * sin(H);
  
  // Maintain luminance (Jz unchanged)
  return vec3(Jz, newAz, newBz);
}

/**
 * Apply vibrance (adaptive saturation)
 * Enhances muted colors more than saturated colors
 * 
 * @param jab Color in JzAzBz space
 * @param vibrance Vibrance amount (-1.0 to 1.0)
 * @return Adjusted color in JzAzBz
 */
vec3 applyVibrance(vec3 jab, float vibrance) {
  float Jz = jab.x;
  float Az = jab.y;
  float Bz = jab.z;
  
  // Calculate chroma
  float C = sqrt(Az * Az + Bz * Bz);
  
  // Calculate hue angle
  float H = atan(Bz, Az);
  
  // Adaptive saturation weight: enhance muted colors more
  // Normalize chroma to approximate 0-1 range (typical max chroma ~0.15 for SDR)
  float normalizedC = clamp(C / 0.15, 0.0, 1.0);
  
  // Weight decreases as chroma increases (muted colors get more enhancement)
  float satWeight = 1.0 - pow(normalizedC, 0.5);
  
  // Apply vibrance with adaptive weight
  float vibranceMultiplier = 1.0 + vibrance * satWeight;
  float newC = C * vibranceMultiplier;
  
  // Reconstruct Az, Bz from new chroma
  float newAz = newC * cos(H);
  float newBz = newC * sin(H);
  
  // Maintain luminance (Jz unchanged)
  return vec3(Jz, newAz, newBz);
}

/**
 * Apply skin tone protection
 * Reduces saturation adjustment in skin tone hue range
 * 
 * @param jab Color in JzAzBz space
 * @param originalJab Original color before saturation adjustment
 * @param protectionStrength Protection strength (0.0 to 1.0)
 * @return Protected color in JzAzBz
 */
vec3 applySkinToneProtection(vec3 jab, vec3 originalJab, float protectionStrength) {
  float Az = originalJab.y;
  float Bz = originalJab.z;
  
  // Calculate hue angle in degrees
  float H = atan(Bz, Az);
  float hueDegrees = degrees(H);
  
  // Normalize hue to 0-360 range
  if (hueDegrees < 0.0) {
    hueDegrees += 360.0;
  }
  
  // Skin tone hue range: approximately 30-60 degrees (orange-yellow)
  // Use smooth falloff for natural protection
  float skinToneWeight = 0.0;
  
  if (hueDegrees >= 20.0 && hueDegrees <= 70.0) {
    // Peak protection at 45 degrees
    float distanceFromPeak = abs(hueDegrees - 45.0);
    skinToneWeight = smoothstep(25.0, 0.0, distanceFromPeak);
  }
  
  // Apply protection by blending toward original color
  float protectionAmount = skinToneWeight * protectionStrength;
  return mix(jab, originalJab, protectionAmount);
}

// ============================================================================
// Main Saturation Processing
// ============================================================================

vec3 applyPerceptualSaturation(vec3 rgb) {
  // Convert to linear space
  rgb = srgbToLinear(rgb);
  
  // Convert to JzAzBz for perceptually uniform adjustments
  vec3 jab = linearRGBToJzAzBz(rgb);
  vec3 originalJab = jab;
  
  // Apply global saturation
  if (abs(u_saturation) > EPSILON) {
    jab = applyGlobalSaturation(jab, u_saturation);
  }
  
  // Apply vibrance
  if (abs(u_vibrance) > EPSILON) {
    jab = applyVibrance(jab, u_vibrance);
  }
  
  // Apply skin tone protection if enabled
  if (u_skinToneProtection && u_skinProtectionStrength > EPSILON) {
    jab = applySkinToneProtection(jab, originalJab, u_skinProtectionStrength);
  }
  
  // Convert back to linear RGB
  rgb = jzAzBzToLinearRGB(jab);
  
  // Clamp to valid range
  rgb = clamp(rgb, 0.0, 1.0);
  
  // Convert back to sRGB for display
  return linearToSrgb(rgb);
}

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  vec3 color = texColor.rgb;
  
  if (u_enabled) {
    color = applyPerceptualSaturation(color);
  }
  
  fragColor = vec4(color, texColor.a);
}
`;

/**
 * Saturation parameters
 */
export interface SaturationParams {
  enabled: boolean;
  saturation: number;              // -1.0 to 1.0 (global saturation)
  vibrance: number;                // -1.0 to 1.0 (adaptive saturation)
  skinToneProtection: boolean;     // Enable skin tone protection
  skinProtectionStrength: number;  // 0.0 to 1.0 (protection strength)
}

/**
 * Default saturation parameters
 */
export const defaultSaturationParams: SaturationParams = {
  enabled: false,
  saturation: 0.0,
  vibrance: 0.0,
  skinToneProtection: true,
  skinProtectionStrength: 0.5,
};

/**
 * Apply saturation uniforms to shader program
 */
export function applySaturationUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  params: SaturationParams
): void {
  const enabledLocation = uniforms.get('u_enabled');
  if (enabledLocation) {
    gl.uniform1i(enabledLocation, params.enabled ? 1 : 0);
  }

  const saturationLocation = uniforms.get('u_saturation');
  if (saturationLocation) {
    gl.uniform1f(saturationLocation, params.saturation);
  }

  const vibranceLocation = uniforms.get('u_vibrance');
  if (vibranceLocation) {
    gl.uniform1f(vibranceLocation, params.vibrance);
  }

  const skinToneProtectionLocation = uniforms.get('u_skinToneProtection');
  if (skinToneProtectionLocation) {
    gl.uniform1i(skinToneProtectionLocation, params.skinToneProtection ? 1 : 0);
  }

  const skinProtectionStrengthLocation = uniforms.get('u_skinProtectionStrength');
  if (skinProtectionStrengthLocation) {
    gl.uniform1f(skinProtectionStrengthLocation, params.skinProtectionStrength);
  }
}
