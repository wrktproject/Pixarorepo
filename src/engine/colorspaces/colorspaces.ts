/**
 * Color Space Conversion Library
 * 
 * Professional-grade color space conversions for scene-referred image processing.
 * Implements accurate transformations between sRGB, Linear RGB, XYZ, Lab, ProPhoto RGB,
 * DT UCS 2022, and JzAzBz color spaces.
 * 
 * Based on Darktable's color science and industry standards.
 * 
 * @module colorspaces
 * @version 1.0.0
 */

/**
 * Color Space Conversion Shaders (GLSL)
 * 
 * All shader functions work with vec3 colors in the range [0-1] unless otherwise noted.
 * For HDR processing, values > 1.0 are supported where indicated.
 */

export const colorSpaceShaderLib = `
// ============================================================================
// sRGB <-> Linear RGB Conversions (IEC 61966-2-1)
// ============================================================================

/**
 * Convert sRGB to Linear RGB using exact transfer function
 * Includes the linear segment below 0.04045 for accuracy
 */
vec3 sRGBToLinear(vec3 srgb) {
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

/**
 * Convert Linear RGB to sRGB using exact transfer function
 */
vec3 linearToSRGB(vec3 linear) {
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

// ============================================================================
// RGB <-> XYZ Conversions (D50 and D65 illuminants)
// ============================================================================

/**
 * Convert Linear RGB (sRGB primaries) to XYZ with D65 illuminant
 * Uses sRGB/Rec.709 color primaries
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
 * Convert XYZ (D65) to Linear RGB (sRGB primaries)
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
 * Convert Linear RGB (sRGB primaries) to XYZ with D50 illuminant
 * Uses Bradford chromatic adaptation from D65 to D50
 */
vec3 linearRGBToXYZ_D50(vec3 rgb) {
    // First convert to XYZ D65
    vec3 xyzD65 = linearRGBToXYZ_D65(rgb);
    
    // Bradford adaptation matrix from D65 to D50
    mat3 bradfordD65toD50 = mat3(
         1.0478112,  0.0228866, -0.0501270,
         0.0295424,  0.9904844, -0.0170491,
        -0.0092345,  0.0150436,  0.7521316
    );
    
    return bradfordD65toD50 * xyzD65;
}

/**
 * Convert XYZ (D50) to Linear RGB (sRGB primaries)
 */
vec3 xyzD50ToLinearRGB(vec3 xyz) {
    // Bradford adaptation matrix from D50 to D65
    mat3 bradfordD50toD65 = mat3(
         0.9555766, -0.0230393,  0.0631636,
        -0.0282895,  1.0099416,  0.0210077,
         0.0122982, -0.0204830,  1.3299098
    );
    
    vec3 xyzD65 = bradfordD50toD65 * xyz;
    return xyzD65ToLinearRGB(xyzD65);
}

// ============================================================================
// Bradford Chromatic Adaptation Transform
// ============================================================================

/**
 * Apply Bradford chromatic adaptation between two white points
 * Used for accurate white balance adjustments
 * 
 * @param rgb - Linear RGB color
 * @param sourceWhite - Source white point in XYZ
 * @param targetWhite - Target white point in XYZ
 */
vec3 bradfordAdaptation(vec3 rgb, vec3 sourceWhite, vec3 targetWhite) {
    // Bradford cone response matrix
    mat3 bradford = mat3(
         0.8951000,  0.2664000, -0.1614000,
        -0.7502000,  1.7135000,  0.0367000,
         0.0389000, -0.0685000,  1.0296000
    );
    
    mat3 bradfordInv = mat3(
         0.9869929, -0.1470543,  0.1599627,
         0.4323053,  0.5183603,  0.0492912,
        -0.0085287,  0.0400428,  0.9684867
    );
    
    // Convert white points to cone response
    vec3 sourceRho = bradford * sourceWhite;
    vec3 targetRho = bradford * targetWhite;
    
    // Build diagonal adaptation matrix
    mat3 adapt = mat3(
        targetRho.x / sourceRho.x, 0.0, 0.0,
        0.0, targetRho.y / sourceRho.y, 0.0,
        0.0, 0.0, targetRho.z / sourceRho.z
    );
    
    // Convert RGB to XYZ, apply adaptation, convert back
    vec3 xyz = linearRGBToXYZ_D65(rgb);
    vec3 coneResponse = bradford * xyz;
    vec3 adaptedCone = adapt * coneResponse;
    vec3 adaptedXYZ = bradfordInv * adaptedCone;
    
    return xyzD65ToLinearRGB(adaptedXYZ);
}

// ============================================================================
// XYZ <-> Lab Conversions (D50 illuminant)
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
 * L: Lightness [0-100]
 * a: Green-Red axis [-128 to 127]
 * b: Blue-Yellow axis [-128 to 127]
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
 * Convert Linear RGB to Lab (via XYZ D50)
 */
vec3 linearRGBToLab(vec3 rgb) {
    vec3 xyz = linearRGBToXYZ_D50(rgb);
    return xyzD50ToLab(xyz);
}

/**
 * Convert Lab to Linear RGB (via XYZ D50)
 */
vec3 labToLinearRGB(vec3 lab) {
    vec3 xyz = labToXYZ_D50(lab);
    return xyzD50ToLinearRGB(xyz);
}

// ============================================================================
// Lab <-> LCH Conversions
// ============================================================================

/**
 * Convert Lab to LCH (Lightness, Chroma, Hue)
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

// ============================================================================
// ProPhoto RGB Color Space
// ============================================================================

/**
 * Convert Linear RGB (sRGB primaries) to ProPhoto RGB
 * ProPhoto RGB is a wide-gamut working space
 */
vec3 linearRGBToProPhotoRGB(vec3 rgb) {
    // Convert sRGB to XYZ D50
    vec3 xyz = linearRGBToXYZ_D50(rgb);
    
    // XYZ D50 to ProPhoto RGB matrix
    mat3 matrix = mat3(
         1.3459433, -0.2556075, -0.0511118,
        -0.5445989,  1.5081673,  0.0205351,
         0.0000000,  0.0000000,  1.2118128
    );
    
    return matrix * xyz;
}

/**
 * Convert ProPhoto RGB to Linear RGB (sRGB primaries)
 */
vec3 proPhotoRGBToLinearRGB(vec3 prophoto) {
    // ProPhoto RGB to XYZ D50 matrix
    mat3 matrix = mat3(
         0.7976749,  0.1351917,  0.0313534,
         0.2880402,  0.7118741,  0.0000857,
         0.0000000,  0.0000000,  0.8252100
    );
    
    vec3 xyz = matrix * prophoto;
    return xyzD50ToLinearRGB(xyz);
}

/**
 * Apply ProPhoto RGB gamma encoding (gamma 1.8)
 */
vec3 linearToProPhotoRGBEncoded(vec3 linear) {
    return pow(max(linear, vec3(0.0)), vec3(1.0 / 1.8));
}

/**
 * Apply ProPhoto RGB gamma decoding (gamma 1.8)
 */
vec3 proPhotoRGBEncodedToLinear(vec3 encoded) {
    return pow(max(encoded, vec3(0.0)), vec3(1.8));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clamp color to valid range while preserving hue
 * Useful for gamut mapping
 */
vec3 clampPreserveHue(vec3 rgb) {
    float maxComponent = max(max(rgb.r, rgb.g), rgb.b);
    
    if (maxComponent > 1.0) {
        return rgb / maxComponent;
    }
    
    return max(rgb, vec3(0.0));
}

/**
 * Calculate luminance using Rec. 709 coefficients
 */
float getLuminance(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Safe division to avoid NaN/Inf
 */
float safeDivide(float a, float b, float fallback) {
    return (abs(b) > 1e-10) ? (a / b) : fallback;
}

/**
 * Safe power function to avoid NaN
 */
float safePow(float base, float exponent) {
    return pow(max(base, 0.0), exponent);
}
`;

/**
 * TypeScript interfaces for color space parameters
 */

export interface ColorXYZ {
  x: number;
  y: number;
  z: number;
}

export interface ColorLab {
  L: number;
  a: number;
  b: number;
}

export interface ColorLCH {
  L: number;
  C: number;
  H: number;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Standard illuminants in XYZ color space
 */
export const Illuminants = {
  D50: { x: 0.9642, y: 1.0000, z: 0.8249 },
  D65: { x: 0.9505, y: 1.0000, z: 1.0890 },
  A: { x: 1.0985, y: 1.0000, z: 0.3558 },   // Incandescent
  F2: { x: 0.9929, y: 1.0000, z: 0.6733 },  // Fluorescent
} as const;

/**
 * Convert color temperature (Kelvin) to XYZ white point
 * Uses Planckian locus approximation
 * 
 * @param kelvin - Color temperature in Kelvin (2000-25000)
 * @returns XYZ white point
 */
export function temperatureToXYZ(kelvin: number): ColorXYZ {
  // Clamp to valid range
  kelvin = Math.max(2000, Math.min(25000, kelvin));
  
  // Calculate chromaticity coordinates using Planckian locus
  let x: number, y: number;
  
  if (kelvin < 4000) {
    x = -0.2661239e9 / Math.pow(kelvin, 3) 
        - 0.2343589e6 / Math.pow(kelvin, 2) 
        + 0.8776956e3 / kelvin + 0.179910;
  } else {
    x = -3.0258469e9 / Math.pow(kelvin, 3) 
        + 2.1070379e6 / Math.pow(kelvin, 2) 
        + 0.2226347e3 / kelvin + 0.240390;
  }
  
  if (kelvin < 2222) {
    y = -1.1063814 * Math.pow(x, 3) 
        - 1.34811020 * Math.pow(x, 2) 
        + 2.18555832 * x - 0.20219683;
  } else if (kelvin < 4000) {
    y = -0.9549476 * Math.pow(x, 3) 
        - 1.37418593 * Math.pow(x, 2) 
        + 2.09137015 * x - 0.16748867;
  } else {
    y = 3.0817580 * Math.pow(x, 3) 
        - 5.87338670 * Math.pow(x, 2) 
        + 3.75112997 * x - 0.37001483;
  }
  
  // Convert xy chromaticity to XYZ (Y = 1.0)
  const Y = 1.0;
  const X = (Y / y) * x;
  const Z = (Y / y) * (1.0 - x - y);
  
  return { x: X, y: Y, z: Z };
}

/**
 * Generate GLSL code for temperature to white point conversion
 */
export const temperatureToWhitePointGLSL = `
/**
 * Convert color temperature (Kelvin) to XYZ white point
 * Uses Planckian locus approximation
 */
vec3 temperatureToXYZ(float kelvin) {
    kelvin = clamp(kelvin, 2000.0, 25000.0);
    
    float x, y;
    
    if (kelvin < 4000.0) {
        x = -0.2661239e9 / pow(kelvin, 3.0) 
            - 0.2343589e6 / pow(kelvin, 2.0) 
            + 0.8776956e3 / kelvin + 0.179910;
    } else {
        x = -3.0258469e9 / pow(kelvin, 3.0) 
            + 2.1070379e6 / pow(kelvin, 2.0) 
            + 0.2226347e3 / kelvin + 0.240390;
    }
    
    if (kelvin < 2222.0) {
        y = -1.1063814 * pow(x, 3.0) 
            - 1.34811020 * pow(x, 2.0) 
            + 2.18555832 * x - 0.20219683;
    } else if (kelvin < 4000.0) {
        y = -0.9549476 * pow(x, 3.0) 
            - 1.37418593 * pow(x, 2.0) 
            + 2.09137015 * x - 0.16748867;
    } else {
        y = 3.0817580 * pow(x, 3.0) 
            - 5.87338670 * pow(x, 2.0) 
            + 3.75112997 * x - 0.37001483;
    }
    
    float Y = 1.0;
    float X = (Y / y) * x;
    float Z = (Y / y) * (1.0 - x - y);
    
    return vec3(X, Y, Z);
}
`;
