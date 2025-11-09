/**
 * Color Space Conversion Utilities
 * Accurate conversions between sRGB, linear RGB, and HSL color spaces
 * Based on industry-standard formulas for professional color accuracy
 */

// Accurate sRGB to Linear RGB conversion
// Uses the official sRGB transfer function, not a simple power curve
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

// Accurate Linear RGB to sRGB conversion
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

// Fast approximation for real-time preview (optional)
// Use when performance is critical and slight inaccuracy is acceptable
vec3 sRGBToLinearFast(vec3 srgb) {
    return pow(srgb, vec3(2.2));
}

vec3 linearToSRGBFast(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

// Helper function for HSL conversion
float hueToRGB(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

// RGB to HSL conversion
// Returns vec3(hue [0-1], saturation [0-1], lightness [0-1])
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

// HSL to RGB conversion
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

// Get luminance using Rec. 709 coefficients
// This is the standard for HDTV and matches what Lightroom uses
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Get perceived brightness (similar to luminance but accounts for human perception)
float getPerceivedBrightness(vec3 color) {
    return sqrt(0.299 * color.r * color.r + 0.587 * color.g * color.g + 0.114 * color.b * color.b);
}

// Smooth curve for masking (used in highlights/shadows)
// Creates a smooth transition between 0 and 1
float smoothCurve(float x, float center, float width) {
    float t = clamp((x - center + width) / (2.0 * width), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t); // Smoothstep
}

// Smooth curve with adjustable falloff
float smoothCurveAdjustable(float x, float center, float width, float falloff) {
    float t = clamp((x - center) / width, -1.0, 1.0);
    return 0.5 + 0.5 * pow(abs(t), falloff) * sign(t);
}
