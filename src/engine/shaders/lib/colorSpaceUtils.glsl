/**
 * Color Space Utilities Library
 * 
 * Provides accurate color space conversions between sRGB, linear RGB, and HSL.
 * All functions follow industry-standard formulas for professional color accuracy.
 * 
 * @module colorSpaceUtils
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

// ============================================================================
// sRGB <-> Linear RGB Conversions
// ============================================================================

/**
 * Convert sRGB color to linear RGB using accurate transfer function
 * 
 * Uses the official sRGB transfer function (IEC 61966-2-1:1999), not a simple
 * power curve. This ensures accurate color reproduction matching professional
 * tools like Adobe Lightroom.
 * 
 * @param srgb - Color in sRGB space [0-1]
 * @return Color in linear RGB space [0-1]
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
 * Convert linear RGB to sRGB using accurate transfer function
 * 
 * @param linear - Color in linear RGB space [0-1]
 * @return Color in sRGB space [0-1]
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

/**
 * Fast sRGB to linear approximation using simple gamma curve
 * 
 * Use when performance is critical and slight inaccuracy is acceptable.
 * Approximately 2-3x faster than accurate conversion.
 * 
 * @param srgb - Color in sRGB space [0-1]
 * @return Color in linear RGB space [0-1]
 */
vec3 sRGBToLinearFast(vec3 srgb) {
    return pow(srgb, vec3(2.2));
}

/**
 * Fast linear to sRGB approximation using simple gamma curve
 * 
 * @param linear - Color in linear RGB space [0-1]
 * @return Color in sRGB space [0-1]
 */
vec3 linearToSRGBFast(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

// ============================================================================
// RGB <-> HSL Conversions
// ============================================================================

/**
 * Helper function for HSL to RGB conversion
 * 
 * @param p - Lower bound value
 * @param q - Upper bound value
 * @param t - Hue component [0-1]
 * @return RGB component value [0-1]
 * @private
 */
float hueToRGB(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

/**
 * Convert RGB to HSL color space
 * 
 * @param rgb - Color in RGB space [0-1]
 * @return vec3(hue [0-1], saturation [0-1], lightness [0-1])
 */
vec3 rgbToHSL(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float delta = maxC - minC;
    
    vec3 hsl;
    
    // Lightness
    hsl.z = (maxC + minC) / 2.0;
    
    if (delta == 0.0) {
        // Achromatic (gray)
        hsl.x = 0.0;
        hsl.y = 0.0;
    } else {
        // Saturation
        hsl.y = hsl.z < 0.5 
            ? delta / (maxC + minC)
            : delta / (2.0 - maxC - minC);
        
        // Hue
        if (rgb.r == maxC) {
            hsl.x = (rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0);
        } else if (rgb.g == maxC) {
            hsl.x = (rgb.b - rgb.r) / delta + 2.0;
        } else {
            hsl.x = (rgb.r - rgb.g) / delta + 4.0;
        }
        hsl.x /= 6.0;
    }
    
    return hsl;
}

/**
 * Convert HSL to RGB color space
 * 
 * @param hsl - vec3(hue [0-1], saturation [0-1], lightness [0-1])
 * @return Color in RGB space [0-1]
 */
vec3 hslToRGB(vec3 hsl) {
    if (hsl.y == 0.0) {
        // Achromatic (gray)
        return vec3(hsl.z);
    }
    
    float q = hsl.z < 0.5 
        ? hsl.z * (1.0 + hsl.y)
        : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    
    vec3 rgb;
    rgb.r = hueToRGB(p, q, hsl.x + 1.0/3.0);
    rgb.g = hueToRGB(p, q, hsl.x);
    rgb.b = hueToRGB(p, q, hsl.x - 1.0/3.0);
    
    return rgb;
}

// ============================================================================
// Luminance & Brightness
// ============================================================================

/**
 * Calculate luminance using Rec. 709 coefficients
 * 
 * This is the standard for HDTV and matches what Adobe Lightroom uses.
 * Represents the perceived brightness of a color.
 * 
 * @param color - RGB color [0-1]
 * @return Luminance value [0-1]
 */
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Calculate perceived brightness accounting for human vision
 * 
 * Similar to luminance but uses a different weighting that better matches
 * human perception of brightness.
 * 
 * @param color - RGB color [0-1]
 * @return Perceived brightness [0-1]
 */
float getPerceivedBrightness(vec3 color) {
    return sqrt(0.299 * color.r * color.r + 0.587 * color.g * color.g + 0.114 * color.b * color.b);
}
