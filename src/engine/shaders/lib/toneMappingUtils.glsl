/**
 * Tone Mapping Utilities Library
 * 
 * Provides various tone mapping algorithms for HDR to LDR conversion.
 * Used to compress high dynamic range images for display on standard monitors.
 * 
 * @module toneMappingUtils
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

// ============================================================================
// Basic Tone Mapping
// ============================================================================

/**
 * Reinhard tone mapping (simple)
 * 
 * Simple and fast tone mapping that compresses HDR values smoothly.
 * Good for general purpose use.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @return LDR color [0-1]
 */
vec3 reinhardToneMap(vec3 color) {
    return color / (color + vec3(1.0));
}

/**
 * Reinhard tone mapping (luminance-based)
 * 
 * Preserves color saturation better than simple Reinhard by operating
 * on luminance only.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @param maxWhite - Maximum white point (default: 1.0)
 * @return LDR color [0-1]
 */
vec3 reinhardToneMapLuminance(vec3 color, float maxWhite) {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float lumTm = (lum * (1.0 + lum / (maxWhite * maxWhite))) / (1.0 + lum);
    return color * (lumTm / lum);
}

// ============================================================================
// Filmic Tone Mapping
// ============================================================================

/**
 * ACES filmic tone mapping
 * 
 * Academy Color Encoding System tone mapping curve.
 * Produces a cinematic look with smooth highlights rolloff.
 * Industry standard for film and high-end games.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @return LDR color [0-1]
 */
vec3 acesToneMap(vec3 color) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

/**
 * Uncharted 2 filmic tone mapping
 * 
 * Tone mapping curve used in Uncharted 2 game.
 * Provides good contrast and color preservation.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @return LDR color [0-1]
 */
vec3 uncharted2ToneMap(vec3 color) {
    const float A = 0.15; // Shoulder strength
    const float B = 0.50; // Linear strength
    const float C = 0.10; // Linear angle
    const float D = 0.20; // Toe strength
    const float E = 0.02; // Toe numerator
    const float F = 0.30; // Toe denominator
    
    vec3 x = color;
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

/**
 * Apply Uncharted 2 tone mapping with exposure
 * 
 * @param color - HDR color (can exceed 1.0)
 * @param exposure - Exposure adjustment
 * @return LDR color [0-1]
 */
vec3 uncharted2ToneMapWithExposure(vec3 color, float exposure) {
    const float W = 11.2; // Linear white point
    vec3 curr = uncharted2ToneMap(color * exposure);
    vec3 whiteScale = vec3(1.0) / uncharted2ToneMap(vec3(W));
    return curr * whiteScale;
}

// ============================================================================
// Exposure-Based Tone Mapping
// ============================================================================

/**
 * Simple exposure tone mapping
 * 
 * Basic exposure adjustment with optional gamma correction.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @param exposure - Exposure value (1.0 = no change)
 * @return LDR color [0-1]
 */
vec3 exposureToneMap(vec3 color, float exposure) {
    return vec3(1.0) - exp(-color * exposure);
}

/**
 * Photographic tone mapping
 * 
 * Simulates photographic film response.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @param exposure - Exposure adjustment
 * @param burn - Highlight burn amount [0-1]
 * @return LDR color [0-1]
 */
vec3 photographicToneMap(vec3 color, float exposure, float burn) {
    vec3 x = color * exposure;
    return (x * (1.0 + x * burn)) / (1.0 + x);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Apply tone mapping with optional enable/disable
 * 
 * Convenience function that applies tone mapping only when enabled.
 * 
 * @param color - HDR color (can exceed 1.0)
 * @param enable - Whether to apply tone mapping
 * @param algorithm - 0=Reinhard, 1=ACES, 2=Uncharted2
 * @return Tone-mapped color [0-1]
 */
vec3 applyToneMapping(vec3 color, bool enable, int algorithm) {
    if (!enable) {
        return clamp(color, 0.0, 1.0);
    }
    
    if (algorithm == 1) {
        return acesToneMap(color);
    } else if (algorithm == 2) {
        return uncharted2ToneMapWithExposure(color, 1.0);
    } else {
        return reinhardToneMap(color);
    }
}

/**
 * Check if color needs tone mapping
 * 
 * Returns true if any component exceeds 1.0 (HDR content).
 * 
 * @param color - Input color
 * @return True if HDR content detected
 */
bool needsToneMapping(vec3 color) {
    return color.r > 1.0 || color.g > 1.0 || color.b > 1.0;
}
