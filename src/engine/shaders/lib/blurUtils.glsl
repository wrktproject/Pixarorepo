/**
 * Blur Utilities Library
 * 
 * Provides various blur algorithms including Gaussian, box, and bilateral filters.
 * Used for effects like clarity, sharpening, and noise reduction.
 * 
 * @module blurUtils
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

// ============================================================================
// Gaussian Blur Kernels
// ============================================================================

/**
 * 5-tap Gaussian blur weights
 * Sigma = 1.0
 */
const float GAUSSIAN_5[3] = float[](0.382928, 0.241732, 0.060626);

/**
 * 9-tap Gaussian blur weights
 * Sigma = 2.0
 */
const float GAUSSIAN_9[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

/**
 * 13-tap Gaussian blur weights
 * Sigma = 3.0
 */
const float GAUSSIAN_13[7] = float[](
    0.1964825501511404,
    0.2969069646728344,
    0.09447039785044732,
    0.010381362401148057,
    0.00038771088998846,
    0.000006156691839767,
    0.00000004206400320012
);

// ============================================================================
// Separable Gaussian Blur
// ============================================================================

/**
 * Apply 5-tap separable Gaussian blur
 * 
 * Fast blur using separable kernel (horizontal or vertical pass).
 * Requires two passes for full 2D blur.
 * 
 * @param tex - Input texture
 * @param uv - Texture coordinates
 * @param direction - Blur direction: (1,0) for horizontal, (0,1) for vertical
 * @param radius - Blur radius in pixels
 * @return Blurred color
 */
vec3 gaussianBlur5(sampler2D tex, vec2 uv, vec2 direction, float radius) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec2 offset = direction * texelSize * radius;
    
    vec3 result = texture(tex, uv).rgb * GAUSSIAN_5[0];
    
    for (int i = 1; i < 3; i++) {
        result += texture(tex, uv + offset * float(i)).rgb * GAUSSIAN_5[i];
        result += texture(tex, uv - offset * float(i)).rgb * GAUSSIAN_5[i];
    }
    
    return result;
}

/**
 * Apply 9-tap separable Gaussian blur
 * 
 * Higher quality blur with larger kernel.
 * 
 * @param tex - Input texture
 * @param uv - Texture coordinates
 * @param direction - Blur direction: (1,0) for horizontal, (0,1) for vertical
 * @param radius - Blur radius in pixels
 * @return Blurred color
 */
vec3 gaussianBlur9(sampler2D tex, vec2 uv, vec2 direction, float radius) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec2 offset = direction * texelSize * radius;
    
    vec3 result = texture(tex, uv).rgb * GAUSSIAN_9[0];
    
    for (int i = 1; i < 5; i++) {
        result += texture(tex, uv + offset * float(i)).rgb * GAUSSIAN_9[i];
        result += texture(tex, uv - offset * float(i)).rgb * GAUSSIAN_9[i];
    }
    
    return result;
}

/**
 * Apply 13-tap separable Gaussian blur
 * 
 * Highest quality blur with largest kernel.
 * 
 * @param tex - Input texture
 * @param uv - Texture coordinates
 * @param direction - Blur direction: (1,0) for horizontal, (0,1) for vertical
 * @param radius - Blur radius in pixels
 * @return Blurred color
 */
vec3 gaussianBlur13(sampler2D tex, vec2 uv, vec2 direction, float radius) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec2 offset = direction * texelSize * radius;
    
    vec3 result = texture(tex, uv).rgb * GAUSSIAN_13[0];
    
    for (int i = 1; i < 7; i++) {
        result += texture(tex, uv + offset * float(i)).rgb * GAUSSIAN_13[i];
        result += texture(tex, uv - offset * float(i)).rgb * GAUSSIAN_13[i];
    }
    
    return result;
}

// ============================================================================
// Box Blur
// ============================================================================

/**
 * Apply simple box blur
 * 
 * Fast but lower quality blur. Good for performance-critical applications.
 * 
 * @param tex - Input texture
 * @param uv - Texture coordinates
 * @param radius - Blur radius in pixels
 * @return Blurred color
 */
vec3 boxBlur(sampler2D tex, vec2 uv, float radius) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec3 result = vec3(0.0);
    float count = 0.0;
    
    int iRadius = int(radius);
    for (int y = -iRadius; y <= iRadius; y++) {
        for (int x = -iRadius; x <= iRadius; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            result += texture(tex, uv + offset).rgb;
            count += 1.0;
        }
    }
    
    return result / count;
}

// ============================================================================
// Bilateral Filter
// ============================================================================

/**
 * Apply bilateral filter (edge-preserving blur)
 * 
 * Blurs while preserving edges based on color similarity.
 * Used for noise reduction without losing detail.
 * 
 * @param tex - Input texture
 * @param uv - Texture coordinates
 * @param radius - Spatial radius in pixels
 * @param sigmaColor - Color similarity threshold
 * @param sigmaSpace - Spatial falloff
 * @return Filtered color
 */
vec3 bilateralFilter(sampler2D tex, vec2 uv, float radius, float sigmaColor, float sigmaSpace) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec3 center = texture(tex, uv).rgb;
    
    vec3 sum = vec3(0.0);
    float weightSum = 0.0;
    
    int iRadius = int(radius);
    for (int y = -iRadius; y <= iRadius; y++) {
        for (int x = -iRadius; x <= iRadius; x++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec3 sample = texture(tex, uv + offset).rgb;
            
            // Spatial weight (Gaussian based on distance)
            float spatialDist = length(vec2(float(x), float(y)));
            float spatialWeight = exp(-spatialDist * spatialDist / (2.0 * sigmaSpace * sigmaSpace));
            
            // Color weight (Gaussian based on color difference)
            vec3 colorDiff = sample - center;
            float colorDist = length(colorDiff);
            float colorWeight = exp(-colorDist * colorDist / (2.0 * sigmaColor * sigmaColor));
            
            float weight = spatialWeight * colorWeight;
            sum += sample * weight;
            weightSum += weight;
        }
    }
    
    return sum / weightSum;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate optimal blur radius for given effect strength
 * 
 * @param strength - Effect strength [0-1]
 * @param minRadius - Minimum radius
 * @param maxRadius - Maximum radius
 * @return Calculated radius
 */
float calculateBlurRadius(float strength, float minRadius, float maxRadius) {
    return mix(minRadius, maxRadius, strength);
}

/**
 * Apply unsharp mask (sharpening)
 * 
 * Sharpens by subtracting blurred version from original.
 * 
 * @param original - Original color
 * @param blurred - Blurred color
 * @param amount - Sharpening amount [0-1]
 * @return Sharpened color
 */
vec3 unsharpMask(vec3 original, vec3 blurred, float amount) {
    vec3 detail = original - blurred;
    return original + detail * amount;
}
