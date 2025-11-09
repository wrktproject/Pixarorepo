/**
 * Mathematical Utilities Library
 * 
 * Provides common mathematical functions for image processing including
 * curves, masking, interpolation, and clamping operations.
 * 
 * @module mathUtils
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

// ============================================================================
// Curve Functions
// ============================================================================

/**
 * Smooth curve for masking (smoothstep-based)
 * 
 * Creates a smooth transition between 0 and 1 centered around a point.
 * Used for luminance-based masking in highlights/shadows adjustments.
 * 
 * @param x - Input value [0-1]
 * @param center - Center point of the curve [0-1]
 * @param width - Width of the transition region [0-1]
 * @return Smoothed value [0-1]
 */
float smoothCurve(float x, float center, float width) {
    float t = clamp((x - center + width) / (2.0 * width), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t); // Smoothstep
}

/**
 * Smooth curve with adjustable falloff
 * 
 * Provides more control over the curve shape with a falloff parameter.
 * Higher falloff values create sharper transitions.
 * 
 * @param x - Input value [0-1]
 * @param center - Center point of the curve [0-1]
 * @param width - Width of the transition region [0-1]
 * @param falloff - Falloff exponent (1.0 = linear, >1.0 = sharper)
 * @return Smoothed value [-1 to 1]
 */
float smoothCurveAdjustable(float x, float center, float width, float falloff) {
    float t = clamp((x - center) / width, -1.0, 1.0);
    return 0.5 + 0.5 * pow(abs(t), falloff) * sign(t);
}

/**
 * Hermite interpolation (smooth cubic curve)
 * 
 * @param edge0 - Lower edge [0-1]
 * @param edge1 - Upper edge [0-1]
 * @param x - Input value [0-1]
 * @return Interpolated value [0-1]
 */
float smootherstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

/**
 * S-curve for contrast adjustment
 * 
 * Creates an S-shaped curve useful for contrast enhancement.
 * 
 * @param x - Input value [0-1]
 * @param strength - Curve strength [0-1]
 * @return Adjusted value [0-1]
 */
float sCurve(float x, float strength) {
    float t = x - 0.5;
    return 0.5 + t / (1.0 + strength * abs(t));
}

// ============================================================================
// Interpolation Functions
// ============================================================================

/**
 * Linear interpolation between two values
 * 
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor [0-1]
 * @return Interpolated value
 */
float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

/**
 * Linear interpolation between two vec3 values
 * 
 * @param a - Start color
 * @param b - End color
 * @param t - Interpolation factor [0-1]
 * @return Interpolated color
 */
vec3 lerp3(vec3 a, vec3 b, float t) {
    return a + (b - a) * t;
}

/**
 * Bilinear interpolation
 * 
 * @param v00 - Value at (0,0)
 * @param v10 - Value at (1,0)
 * @param v01 - Value at (0,1)
 * @param v11 - Value at (1,1)
 * @param tx - X interpolation factor [0-1]
 * @param ty - Y interpolation factor [0-1]
 * @return Interpolated value
 */
float bilerp(float v00, float v10, float v01, float v11, float tx, float ty) {
    float v0 = lerp(v00, v10, tx);
    float v1 = lerp(v01, v11, tx);
    return lerp(v0, v1, ty);
}

// ============================================================================
// Clamping & Range Functions
// ============================================================================

/**
 * Clamp value to [0-1] range
 * 
 * @param x - Input value
 * @return Clamped value [0-1]
 */
float clamp01(float x) {
    return clamp(x, 0.0, 1.0);
}

/**
 * Clamp vec3 to [0-1] range
 * 
 * @param v - Input vector
 * @return Clamped vector [0-1]
 */
vec3 clamp01(vec3 v) {
    return clamp(v, 0.0, 1.0);
}

/**
 * Remap value from one range to another
 * 
 * @param value - Input value
 * @param inMin - Input range minimum
 * @param inMax - Input range maximum
 * @param outMin - Output range minimum
 * @param outMax - Output range maximum
 * @return Remapped value
 */
float remap(float value, float inMin, float inMax, float outMin, float outMax) {
    float t = (value - inMin) / (inMax - inMin);
    return outMin + t * (outMax - outMin);
}

/**
 * Soft clamp (asymptotic approach to limits)
 * 
 * Prevents hard clipping by smoothly approaching the limit.
 * 
 * @param x - Input value
 * @param limit - Soft limit value
 * @return Soft-clamped value
 */
float softClamp(float x, float limit) {
    return x / (1.0 + abs(x) / limit);
}

// ============================================================================
// Masking Functions
// ============================================================================

/**
 * Create luminance-based mask for highlights
 * 
 * Returns 1.0 for bright areas, 0.0 for dark areas.
 * 
 * @param luminance - Input luminance [0-1]
 * @param threshold - Brightness threshold [0-1]
 * @param softness - Transition softness [0-1]
 * @return Mask value [0-1]
 */
float highlightMask(float luminance, float threshold, float softness) {
    return smoothCurve(luminance, threshold, softness);
}

/**
 * Create luminance-based mask for shadows
 * 
 * Returns 1.0 for dark areas, 0.0 for bright areas.
 * 
 * @param luminance - Input luminance [0-1]
 * @param threshold - Darkness threshold [0-1]
 * @param softness - Transition softness [0-1]
 * @return Mask value [0-1]
 */
float shadowMask(float luminance, float threshold, float softness) {
    return 1.0 - smoothCurve(luminance, threshold, softness);
}

/**
 * Create saturation-based mask
 * 
 * Returns 1.0 for saturated colors, 0.0 for desaturated colors.
 * 
 * @param saturation - Input saturation [0-1]
 * @param threshold - Saturation threshold [0-1]
 * @param softness - Transition softness [0-1]
 * @return Mask value [0-1]
 */
float saturationMask(float saturation, float threshold, float softness) {
    return smoothCurve(saturation, threshold, softness);
}
