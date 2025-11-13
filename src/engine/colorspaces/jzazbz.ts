/**
 * JzAzBz Color Space
 * 
 * A perceptually uniform color space designed for HDR and wide color gamut.
 * Developed by Safdar et al. (2017) for better perceptual uniformity than Lab.
 * 
 * The space uses:
 * - Jz: Perceptual lightness (supports HDR, values > 1.0)
 * - Az: Red-green opponent color axis
 * - Bz: Yellow-blue opponent color axis
 * 
 * Key features:
 * - Better perceptual uniformity than CIELAB
 * - Supports HDR (high dynamic range) values
 * - Hue linearity improvements
 * 
 * Reference: Safdar, M., Cui, G., Kim, Y. J., & Luo, M. R. (2017).
 * "Perceptually uniform color space for image signals including high dynamic range and wide gamut"
 * 
 * @module jzazbz
 * @version 1.0.0
 */

/**
 * JzAzBz Color Space Conversion Shaders
 */

export const jzAzBzShaderLib = `
// ============================================================================
// JzAzBz Color Space (HDR-capable perceptual space)
// ============================================================================

// Constants for JzAzBz conversion
const float JZ_B = 1.15;
const float JZ_G = 0.66;
const float JZ_C1 = 3424.0 / 4096.0;
const float JZ_C2 = 2413.0 / 128.0;
const float JZ_C3 = 2392.0 / 128.0;
const float JZ_N = 2610.0 / 16384.0;
const float JZ_P = 1.7 * 2523.0 / 32.0;
const float JZ_D = -0.56;
const float JZ_D0 = 1.6295499532821566e-11;

/**
 * PQ (Perceptual Quantizer) EOTF - used in JzAzBz
 * This is the ST.2084 transfer function for HDR
 */
float pqEOTF(float x) {
    float xp = pow(x, 1.0 / JZ_P);
    float num = max(xp - JZ_C1, 0.0);
    float den = JZ_C2 - JZ_C3 * xp;
    return pow(num / den, 1.0 / JZ_N);
}

/**
 * Inverse PQ EOTF
 */
float pqEOTFInv(float x) {
    float xp = pow(x, JZ_N);
    float num = JZ_C1 + JZ_C2 * xp;
    float den = 1.0 + JZ_C3 * xp;
    return pow(num / den, JZ_P);
}

/**
 * Convert Linear RGB to JzAzBz
 * Supports HDR values (rgb > 1.0)
 * 
 * @param rgb - Linear RGB color (can be > 1.0 for HDR)
 * @return vec3(Jz, Az, Bz)
 */
vec3 linearRGBToJzAzBz(vec3 rgb) {
    // Convert to XYZ D65
    mat3 rgbToXYZ = mat3(
        0.4124564, 0.3575761, 0.1804375,
        0.2126729, 0.7151522, 0.0721750,
        0.0193339, 0.1191920, 0.9503041
    );
    
    vec3 xyz = rgbToXYZ * rgb;
    
    // Normalize for 10000 cd/m² white point
    xyz = xyz / 10000.0;
    
    // Convert to LMS (cone response)
    mat3 xyzToLMS = mat3(
         0.41478972,  0.579999,  0.0146480,
        -0.2015100,   1.120649,  0.0531008,
        -0.0166008,   0.264800,  0.6684799
    );
    
    vec3 lms = xyzToLMS * xyz;
    
    // Apply PQ EOTF
    vec3 lmsPQ;
    lmsPQ.x = pqEOTFInv(lms.x);
    lmsPQ.y = pqEOTFInv(lms.y);
    lmsPQ.z = pqEOTFInv(lms.z);
    
    // Convert to Izazbz
    mat3 lmsToIzazbz = mat3(
        0.5,       0.5,       0.0,
        3.524000, -4.066708,  0.542708,
        0.199076,  1.096799, -1.295875
    );
    
    vec3 izazbz = lmsToIzazbz * lmsPQ;
    
    // Calculate Jz from Iz
    float Jz = ((1.0 + JZ_D) * izazbz.x) / (1.0 + JZ_D * izazbz.x) - JZ_D0;
    
    return vec3(Jz, izazbz.y, izazbz.z);
}

/**
 * Convert JzAzBz to Linear RGB
 * 
 * @param jab - vec3(Jz, Az, Bz)
 * @return Linear RGB color (can be > 1.0 for HDR)
 */
vec3 jzAzBzToLinearRGB(vec3 jab) {
    float Jz = jab.x;
    float Az = jab.y;
    float Bz = jab.z;
    
    // Calculate Iz from Jz
    float Iz = (Jz + JZ_D0) / (1.0 + JZ_D - JZ_D * (Jz + JZ_D0));
    
    // Convert from Izazbz to LMS'
    mat3 izazbzToLMS = mat3(
        1.0,  0.138605043271539,  0.0580473161561189,
        1.0, -0.138605043271539, -0.0580473161561189,
        1.0, -0.0960192420263190, -0.811891896056039
    );
    
    vec3 lmsPQ = izazbzToLMS * vec3(Iz, Az, Bz);
    
    // Apply inverse PQ EOTF
    vec3 lms;
    lms.x = pqEOTF(lmsPQ.x);
    lms.y = pqEOTF(lmsPQ.y);
    lms.z = pqEOTF(lmsPQ.z);
    
    // Convert from LMS to XYZ
    mat3 lmsToXYZ = mat3(
         1.9242264357876067, -1.0047923125953657,  0.037651404030618,
         0.3503167620949991,  0.7264811939316552, -0.065384422948085,
        -0.0909828109828476, -0.3127282905230739,  1.522766561305260
    );
    
    vec3 xyz = lmsToXYZ * lms;
    
    // Denormalize from 10000 cd/m²
    xyz = xyz * 10000.0;
    
    // Convert to Linear RGB
    mat3 xyzToRGB = mat3(
         3.2404542, -1.5371385, -0.4985314,
        -0.9692660,  1.8760108,  0.0415560,
         0.0556434, -0.2040259,  1.0572252
    );
    
    return xyzToRGB * xyz;
}

/**
 * Convert JzAzBz to JzCzHz (cylindrical coordinates)
 * 
 * Jz: Lightness
 * Cz: Chroma (colorfulness)
 * Hz: Hue angle (radians)
 */
vec3 jzAzBzToJzCzHz(vec3 jab) {
    float Jz = jab.x;
    float Cz = sqrt(jab.y * jab.y + jab.z * jab.z);
    float Hz = atan(jab.z, jab.y);
    
    return vec3(Jz, Cz, Hz);
}

/**
 * Convert JzCzHz to JzAzBz
 */
vec3 jzCzHzToJzAzBz(vec3 jch) {
    float Jz = jch.x;
    float Az = jch.y * cos(jch.z);
    float Bz = jch.y * sin(jch.z);
    
    return vec3(Jz, Az, Bz);
}

// ============================================================================
// Perceptual Saturation and Vibrance using JzAzBz
// ============================================================================

/**
 * Apply perceptual saturation in JzAzBz space
 * Maintains perceptual lightness while adjusting chroma
 * 
 * @param rgb - Linear RGB color
 * @param saturation - Saturation multiplier (1.0 = no change, 0.0 = grayscale, 2.0 = double)
 */
vec3 applySaturationJzAzBz(vec3 rgb, float saturation) {
    vec3 jab = linearRGBToJzAzBz(rgb);
    
    // Scale chroma components
    jab.y *= saturation;
    jab.z *= saturation;
    
    return jzAzBzToLinearRGB(jab);
}

/**
 * Apply vibrance (adaptive saturation) in JzAzBz space
 * Enhances muted colors more than already-saturated colors
 * Includes skin tone protection
 * 
 * @param rgb - Linear RGB color
 * @param vibrance - Vibrance amount (-1 to 1)
 * @param skinProtection - Strength of skin tone protection (0-1)
 */
vec3 applyVibranceJzAzBz(vec3 rgb, float vibrance, float skinProtection) {
    vec3 jab = linearRGBToJzAzBz(rgb);
    vec3 jch = jzAzBzToJzCzHz(jab);
    
    float Jz = jch.x;
    float Cz = jch.y;
    float Hz = jch.z;
    
    // Adaptive saturation: enhance muted colors more
    // Use square root for smoother falloff
    float chromaWeight = 1.0 - sqrt(clamp(Cz / 0.5, 0.0, 1.0));
    float saturationAdjust = 1.0 + vibrance * chromaWeight;
    
    // Skin tone protection (hue around 30-60 degrees, 0.52-1.05 radians)
    float hueDegrees = degrees(Hz);
    if (hueDegrees < 0.0) hueDegrees += 360.0;
    
    float skinMask = smoothstep(20.0, 40.0, hueDegrees) 
                   * (1.0 - smoothstep(40.0, 70.0, hueDegrees));
    
    saturationAdjust = mix(saturationAdjust, 1.0, skinMask * skinProtection);
    
    // Apply saturation adjustment
    jch.y *= saturationAdjust;
    
    // Convert back
    jab = jzCzHzToJzAzBz(jch);
    return jzAzBzToLinearRGB(jab);
}

/**
 * Adjust lightness in JzAzBz space
 * Provides perceptually uniform brightness control
 * 
 * @param rgb - Linear RGB color
 * @param lightnessShift - Lightness adjustment (-1 to 1)
 */
vec3 adjustLightnessJzAzBz(vec3 rgb, float lightnessShift) {
    vec3 jab = linearRGBToJzAzBz(rgb);
    jab.x = clamp(jab.x + lightnessShift * 0.1, 0.0, 1.0);
    return jzAzBzToLinearRGB(jab);
}

/**
 * Rotate hue in JzAzBz space
 * 
 * @param rgb - Linear RGB color
 * @param hueShift - Hue rotation in radians
 */
vec3 rotateHueJzAzBz(vec3 rgb, float hueShift) {
    vec3 jab = linearRGBToJzAzBz(rgb);
    vec3 jch = jzAzBzToJzCzHz(jab);
    
    jch.z += hueShift;
    
    jab = jzCzHzToJzAzBz(jch);
    return jzAzBzToLinearRGB(jab);
}

/**
 * Apply color grading in JzAzBz space
 * Allows independent control of lightness, chroma, and hue
 * 
 * @param rgb - Linear RGB color
 * @param lightnessShift - Lightness adjustment (-1 to 1)
 * @param chromaScale - Chroma multiplier (0-2)
 * @param hueShift - Hue rotation in radians
 */
vec3 colorGradeJzAzBz(vec3 rgb, float lightnessShift, float chromaScale, float hueShift) {
    vec3 jab = linearRGBToJzAzBz(rgb);
    vec3 jch = jzAzBzToJzCzHz(jab);
    
    // Apply adjustments
    jch.x = clamp(jch.x + lightnessShift * 0.1, 0.0, 1.0);
    jch.y *= chromaScale;
    jch.z += hueShift;
    
    jab = jzCzHzToJzAzBz(jch);
    return jzAzBzToLinearRGB(jab);
}
`;

/**
 * TypeScript interface for JzAzBz color
 */
export interface ColorJzAzBz {
  Jz: number;  // Perceptual lightness [0-~0.17 for SDR, higher for HDR]
  Az: number;  // Red-green axis
  Bz: number;  // Yellow-blue axis
}

/**
 * TypeScript interface for JzCzHz color (cylindrical)
 */
export interface ColorJzCzHz {
  Jz: number;  // Perceptual lightness
  Cz: number;  // Chroma (colorfulness)
  Hz: number;  // Hue angle (radians)
}

/**
 * Parameters for perceptual saturation
 */
export interface SaturationParams {
  saturation: number;      // Global saturation (-1 to 1, where 0 = no change)
  vibrance: number;        // Adaptive saturation (-1 to 1)
  skinProtection: number;  // Skin tone protection strength (0-1)
}

/**
 * Default saturation parameters
 */
export const defaultSaturationParams: SaturationParams = {
  saturation: 0,
  vibrance: 0,
  skinProtection: 0.5,
};

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
