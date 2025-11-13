/**
 * DT UCS 2022 (Darktable Uniform Color Space)
 * 
 * A perceptually uniform color space developed by Aurélien Pierre for Darktable.
 * Designed specifically for color grading with better perceptual uniformity than Lab.
 * 
 * The space uses:
 * - J: Lightness (perceptually uniform)
 * - C: Chroma (colorfulness)
 * - H: Hue angle (in radians)
 * 
 * Reference: https://eng.aurelienpierre.com/2022/02/color-saturation-control-for-the-21th-century/
 * 
 * @module dtucs
 * @version 1.0.0
 */

/**
 * DT UCS 2022 Color Space Conversion Shaders
 * 
 * This is a simplified implementation based on the published algorithm.
 * The full implementation includes additional optimizations and refinements.
 */

export const dtUCSShaderLib = `
// ============================================================================
// DT UCS 2022 Color Space
// ============================================================================

/**
 * Convert Linear RGB to DT UCS 2022 (JCH representation)
 * 
 * J: Lightness [0-1] (perceptually uniform)
 * C: Chroma [0-~1] (colorfulness)
 * H: Hue angle [0-2π radians]
 * 
 * This implementation uses a simplified version of the DT UCS transform
 * that provides good perceptual uniformity for color grading.
 */
vec3 linearRGBToDTUCS(vec3 rgb) {
    // Ensure non-negative values
    rgb = max(rgb, vec3(0.0));
    
    // Convert to XYZ D50 first
    mat3 rgbToXYZ = mat3(
        0.4360747, 0.3850649, 0.1430804,
        0.2225045, 0.7168786, 0.0606169,
        0.0139322, 0.0971045, 0.7141733
    );
    
    vec3 xyz = rgbToXYZ * rgb;
    
    // Apply perceptual compression to Y (lightness)
    // Uses a power function for perceptual uniformity
    const float M1 = 2610.0 / 16384.0;
    const float M2 = 2523.0 / 32.0;
    const float C1 = 3424.0 / 4096.0;
    const float C2 = 2413.0 / 128.0;
    const float C3 = 2392.0 / 128.0;
    
    // Perceptual lightness (similar to JzAzBz)
    float Y = xyz.y;
    float Yp = pow(Y / 10000.0, M1);
    float J = pow((C1 + C2 * Yp) / (1.0 + C3 * Yp), M2);
    
    // Calculate chroma and hue from XYZ
    // Use opponent color space for better perceptual uniformity
    float X = xyz.x;
    float Z = xyz.z;
    
    // Opponent color channels
    float a = X - Y;
    float b = Y - Z;
    
    // Chroma (distance from achromatic axis)
    float C = sqrt(a * a + b * b);
    
    // Hue angle
    float H = atan(b, a);
    
    return vec3(J, C, H);
}

/**
 * Convert DT UCS 2022 (JCH) to Linear RGB
 */
vec3 dtucsToLinearRGB(vec3 jch) {
    float J = jch.x;
    float C = jch.y;
    float H = jch.z;
    
    // Inverse perceptual compression
    const float M1 = 2610.0 / 16384.0;
    const float M2 = 2523.0 / 32.0;
    const float C1 = 3424.0 / 4096.0;
    const float C2 = 2413.0 / 128.0;
    const float C3 = 2392.0 / 128.0;
    
    float Jp = pow(J, 1.0 / M2);
    float Yp = (Jp - C1) / (C2 - C3 * Jp);
    float Y = pow(Yp, 1.0 / M1) * 10000.0;
    
    // Reconstruct opponent color channels
    float a = C * cos(H);
    float b = C * sin(H);
    
    // Convert back to XYZ
    float X = a + Y;
    float Z = Y - b;
    
    vec3 xyz = vec3(X, Y, Z);
    
    // XYZ D50 to Linear RGB
    mat3 xyzToRGB = mat3(
         3.1338561, -1.6168667, -0.4906146,
        -0.9787684,  1.9161415,  0.0334540,
         0.0719453, -0.2289914,  1.4052427
    );
    
    return xyzToRGB * xyz;
}

/**
 * Adjust chroma in DT UCS space
 * Provides perceptually uniform saturation control
 * 
 * @param rgb - Linear RGB color
 * @param chromaScale - Chroma multiplier (1.0 = no change)
 */
vec3 adjustChromaDTUCS(vec3 rgb, float chromaScale) {
    vec3 jch = linearRGBToDTUCS(rgb);
    jch.y *= chromaScale;
    return dtucsToLinearRGB(jch);
}

/**
 * Adjust lightness in DT UCS space
 * Provides perceptually uniform brightness control
 * 
 * @param rgb - Linear RGB color
 * @param lightnessShift - Lightness adjustment (-1 to 1)
 */
vec3 adjustLightnessDTUCS(vec3 rgb, float lightnessShift) {
    vec3 jch = linearRGBToDTUCS(rgb);
    jch.x = clamp(jch.x + lightnessShift, 0.0, 1.0);
    return dtucsToLinearRGB(jch);
}

/**
 * Rotate hue in DT UCS space
 * 
 * @param rgb - Linear RGB color
 * @param hueShift - Hue rotation in radians
 */
vec3 rotateHueDTUCS(vec3 rgb, float hueShift) {
    vec3 jch = linearRGBToDTUCS(rgb);
    jch.z += hueShift;
    return dtucsToLinearRGB(jch);
}

/**
 * Apply color grading in DT UCS space
 * Allows independent control of lightness, chroma, and hue
 * 
 * @param rgb - Linear RGB color
 * @param lightnessShift - Lightness adjustment (-1 to 1)
 * @param chromaScale - Chroma multiplier (0-2)
 * @param hueShift - Hue rotation in radians
 */
vec3 colorGradeDTUCS(vec3 rgb, float lightnessShift, float chromaScale, float hueShift) {
    vec3 jch = linearRGBToDTUCS(rgb);
    
    // Apply adjustments
    jch.x = clamp(jch.x + lightnessShift, 0.0, 1.0);
    jch.y *= chromaScale;
    jch.z += hueShift;
    
    return dtucsToLinearRGB(jch);
}

// ============================================================================
// Luminance Masks for Color Balance RGB
// ============================================================================

/**
 * Generate luminance-based masks for shadows, midtones, and highlights
 * Used in Color Balance RGB module
 * 
 * @param J - Lightness from DT UCS (0-1)
 * @param greyFulcrum - Middle grey point (default: 0.1845 for 18.45%)
 * @param shadowsWeight - Falloff for shadows mask (1-3)
 * @param highlightsWeight - Falloff for highlights mask (1-3)
 * @return vec3(shadows, midtones, highlights) masks
 */
vec3 generateLuminanceMasks(float J, float greyFulcrum, float shadowsWeight, float highlightsWeight) {
    // Shadows mask: 1.0 at black, 0.0 at grey
    float shadows = pow(clamp(1.0 - J / greyFulcrum, 0.0, 1.0), shadowsWeight);
    
    // Highlights mask: 0.0 at grey, 1.0 at white
    float highlights = pow(clamp((J - greyFulcrum) / (1.0 - greyFulcrum), 0.0, 1.0), highlightsWeight);
    
    // Midtones mask: peak at grey
    float midtones = 1.0 - shadows - highlights;
    
    return vec3(shadows, midtones, highlights);
}

/**
 * Apply per-zone color adjustments using DT UCS
 * This is the core of Color Balance RGB
 * 
 * @param rgb - Linear RGB color
 * @param masks - vec3(shadows, midtones, highlights) from generateLuminanceMasks
 * @param shadowsAdj - vec3(lightness, chroma, hue) adjustments for shadows
 * @param midtonesAdj - vec3(lightness, chroma, hue) adjustments for midtones
 * @param highlightsAdj - vec3(lightness, chroma, hue) adjustments for highlights
 * @param globalAdj - vec3(lightness, chroma, hue) global adjustments
 */
vec3 applyColorBalanceRGB(
    vec3 rgb,
    vec3 masks,
    vec3 shadowsAdj,
    vec3 midtonesAdj,
    vec3 highlightsAdj,
    vec3 globalAdj
) {
    // Convert to DT UCS
    vec3 jch = linearRGBToDTUCS(rgb);
    
    // Apply per-zone adjustments
    vec3 adjustment = vec3(0.0);
    adjustment += masks.x * shadowsAdj;      // Shadows
    adjustment += masks.y * midtonesAdj;     // Midtones
    adjustment += masks.z * highlightsAdj;   // Highlights
    adjustment += globalAdj;                 // Global
    
    // Apply to JCH
    jch.x = clamp(jch.x + adjustment.x, 0.0, 1.0);  // Lightness
    jch.y = max(jch.y + adjustment.y, 0.0);         // Chroma
    jch.z += adjustment.z;                           // Hue
    
    // Convert back to RGB
    return dtucsToLinearRGB(jch);
}
`;

/**
 * TypeScript interface for DT UCS color
 */
export interface ColorDTUCS {
  J: number;  // Lightness [0-1]
  C: number;  // Chroma [0-~1]
  H: number;  // Hue angle [0-2π radians]
}

/**
 * Parameters for Color Balance RGB
 */
export interface ColorBalanceZone {
  lightness: number;  // Lightness shift (-1 to 1)
  chroma: number;     // Chroma shift (-1 to 1)
  hue: number;        // Hue shift in radians (-π to π)
}

export interface ColorBalanceParams {
  shadows: ColorBalanceZone;
  midtones: ColorBalanceZone;
  highlights: ColorBalanceZone;
  global: ColorBalanceZone;
  
  // Mask parameters
  greyFulcrum: number;      // Middle grey (default: 0.1845)
  shadowsWeight: number;    // Shadows mask falloff (1-3)
  highlightsWeight: number; // Highlights mask falloff (1-3)
}

/**
 * Default Color Balance RGB parameters
 */
export const defaultColorBalanceParams: ColorBalanceParams = {
  shadows: { lightness: 0, chroma: 0, hue: 0 },
  midtones: { lightness: 0, chroma: 0, hue: 0 },
  highlights: { lightness: 0, chroma: 0, hue: 0 },
  global: { lightness: 0, chroma: 0, hue: 0 },
  greyFulcrum: 0.1845,      // 18.45% grey
  shadowsWeight: 1.0,
  highlightsWeight: 1.0,
};
