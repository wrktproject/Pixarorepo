# Design Document - Advanced Shader Effects & Color Processing

## Overview

This design implements a professional-grade WebGL shader pipeline that delivers Lightroom-quality image adjustments with accurate color science, proper tone mapping, and real-time performance. The system uses multi-pass rendering, proper color space conversions, and optimized algorithms to match Adobe Lightroom's adjustment quality.

## Architecture

### High-Level Pipeline

```
Input Image (sRGB 8-bit)
    ↓
[Pass 0] Load & Convert to Linear RGB (float16)
    ↓
[Pass 1] Tonal Adjustments (exposure, contrast, highlights, shadows)
    ↓
[Pass 2] Color Adjustments (temperature, tint, vibrance, saturation)
    ↓
[Pass 3] HSL Adjustments (per-channel hue/sat/lum)
    ↓
[Pass 4] Clarity (Gaussian blur → high-pass → composite)
    ↓
[Pass 5] Detail (sharpening, noise reduction)
    ↓
[Pass 6] Effects (vignette, grain)
    ↓
[Pass 7] Tone Mapping & Convert to sRGB
    ↓
Output to Canvas (sRGB 8-bit)
```

### Color Space Strategy

**All mathematical operations happen in linear RGB:**
- Input: sRGB → Linear RGB (gamma decode)
- Processing: All adjustments in linear space
- Output: Linear RGB → sRGB (gamma encode)

**Why Linear Space?**
- Exposure: Doubling brightness = +1 stop (only works in linear)
- Blending: Averaging colors produces correct results
- Color mixing: Physically accurate color operations
- Tone mapping: HDR compression works correctly

## Components

### 1. Color Space Conversion Utilities

**File:** `src/engine/shaders/colorSpace.glsl`

```glsl
#version 300 es
precision highp float;

// Accurate sRGB to Linear conversion
vec3 sRGBToLinear(vec3 srgb) {
    // Use accurate sRGB transfer function, not simple pow(2.2)
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
vec3 sRGBToLinearFast(vec3 srgb) {
    return pow(srgb, vec3(2.2));
}

vec3 linearToSRGBFast(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

// RGB to HSL conversion
vec3 rgbToHSL(vec3 rgb) {
    float maxC = max(max(rgb.r, rgb.g), rgb.b);
    float minC = min(min(rgb.r, rgb.g), rgb.b);
    float delta = maxC - minC;
    
    vec3 hsl;
    
    // Luminance
    hsl.z = (maxC + minC) / 2.0;
    
    if (delta == 0.0) {
        // Achromatic
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
        // Achromatic
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

float hueToRGB(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
}

// Get luminance (Rec. 709)
float getLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
```

### 2. Tonal Adjustments Shader

**File:** `src/engine/shaders/tonal.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_exposure;      // -5.0 to +5.0 stops
uniform float u_contrast;      // 0.0 to 2.0 (1.0 = neutral)
uniform float u_highlights;    // -1.0 to +1.0
uniform float u_shadows;       // -1.0 to +1.0
uniform float u_whites;        // -1.0 to +1.0
uniform float u_blacks;        // -1.0 to +1.0

// Include color space functions
// (In practice, use #include or copy functions here)

// Smooth curve for highlights/shadows
float smoothCurve(float x, float center, float width) {
    float t = clamp((x - center + width) / (2.0 * width), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t); // Smoothstep
}

void main() {
    vec4 texColor = texture(u_texture, v_texCoord);
    
    // Convert to linear RGB
    vec3 color = sRGBToLinear(texColor.rgb);
    
    // 1. EXPOSURE (photographic stops)
    // +1 stop = double brightness, -1 stop = half brightness
    color *= pow(2.0, u_exposure);
    
    // 2. HIGHLIGHTS & SHADOWS (luminance-based)
    float lum = getLuminance(color);
    
    // Highlights: affect bright areas (lum > 0.5)
    if (u_highlights != 0.0) {
        float highlightMask = smoothCurve(lum, 0.7, 0.3);
        float highlightAdjust = 1.0 + u_highlights * highlightMask;
        color *= highlightAdjust;
    }
    
    // Shadows: affect dark areas (lum < 0.5)
    if (u_shadows != 0.0) {
        float shadowMask = 1.0 - smoothCurve(lum, 0.3, 0.3);
        float shadowAdjust = 1.0 + u_shadows * shadowMask;
        color *= shadowAdjust;
    }
    
    // 3. WHITES & BLACKS (extreme tones)
    // Recalculate luminance after highlights/shadows
    lum = getLuminance(color);
    
    // Whites: affect very bright areas (lum > 0.8)
    if (u_whites != 0.0) {
        float whiteMask = smoothCurve(lum, 0.85, 0.15);
        float whiteAdjust = 1.0 + u_whites * whiteMask;
        color *= whiteAdjust;
    }
    
    // Blacks: affect very dark areas (lum < 0.2)
    if (u_blacks != 0.0) {
        float blackMask = 1.0 - smoothCurve(lum, 0.15, 0.15);
        float blackAdjust = 1.0 + u_blacks * blackMask;
        color *= blackAdjust;
    }
    
    // 4. CONTRAST (around midpoint)
    // Apply after exposure and tone adjustments
    color = (color - 0.5) * u_contrast + 0.5;
    
    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);
    
    fragColor = vec4(color, texColor.a);
}
```

### 3. Color Adjustments Shader

**File:** `src/engine/shaders/color.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_temperature;   // -100 to +100
uniform float u_tint;          // -100 to +100
uniform float u_vibrance;      // -1.0 to +1.0
uniform float u_saturation;    // -1.0 to +1.0

// Color temperature matrices (Lightroom-style)
const vec3 warmMatrix = vec3(1.05, 1.02, 0.95);
const vec3 coolMatrix = vec3(0.95, 1.01, 1.05);

// Tint matrices (magenta/green shift)
const vec3 magentaMatrix = vec3(1.02, 0.98, 1.02);
const vec3 greenMatrix = vec3(0.98, 1.02, 0.98);

void main() {
    vec4 texColor = texture(u_texture, v_texCoord);
    vec3 color = texColor.rgb; // Already in linear from previous pass
    
    // 1. TEMPERATURE (warm/cool)
    if (u_temperature != 0.0) {
        float t = u_temperature / 100.0; // Normalize to -1..+1
        vec3 tempMatrix = mix(coolMatrix, warmMatrix, (t + 1.0) * 0.5);
        color *= tempMatrix;
    }
    
    // 2. TINT (magenta/green)
    if (u_tint != 0.0) {
        float t = u_tint / 100.0; // Normalize to -1..+1
        vec3 tintMatrix = mix(greenMatrix, magentaMatrix, (t + 1.0) * 0.5);
        color *= tintMatrix;
    }
    
    // 3. VIBRANCE (smart saturation)
    // Boosts muted colors more than saturated colors
    if (u_vibrance != 0.0) {
        vec3 hsl = rgbToHSL(color);
        float satBoost = u_vibrance * (1.0 - hsl.y); // More boost for low saturation
        hsl.y = clamp(hsl.y + satBoost, 0.0, 1.0);
        color = hslToRGB(hsl);
    }
    
    // 4. SATURATION (uniform)
    if (u_saturation != 0.0) {
        vec3 hsl = rgbToHSL(color);
        hsl.y = clamp(hsl.y * (1.0 + u_saturation), 0.0, 1.0);
        color = hslToRGB(hsl);
    }
    
    fragColor = vec4(color, texColor.a);
}
```

### 4. Clarity Shader (Multi-Pass)

**Pass 1 - Gaussian Blur:**

**File:** `src/engine/shaders/gaussianBlur.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_direction; // (1,0) for horizontal, (0,1) for vertical
uniform float u_radius;   // Blur radius in pixels

// 9-tap Gaussian kernel
const float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
    vec2 texelSize = 1.0 / vec2(textureSize(u_texture, 0));
    vec2 offset = u_direction * texelSize * u_radius;
    
    vec3 result = texture(u_texture, v_texCoord).rgb * weights[0];
    
    for (int i = 1; i < 5; i++) {
        result += texture(u_texture, v_texCoord + offset * float(i)).rgb * weights[i];
        result += texture(u_texture, v_texCoord - offset * float(i)).rgb * weights[i];
    }
    
    fragColor = vec4(result, 1.0);
}
```

**Pass 2 - Clarity Composite:**

**File:** `src/engine/shaders/clarityComposite.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_original;  // Original image
uniform sampler2D u_blurred;   // Blurred image
uniform float u_clarity;       // 0.0 to 1.0

void main() {
    vec3 original = texture(u_original, v_texCoord).rgb;
    vec3 blurred = texture(u_blurred, v_texCoord).rgb;
    
    // High-pass filter: original - blurred
    vec3 highpass = original - blurred;
    
    // Add high-pass back with user-controlled amount
    vec3 result = original + highpass * u_clarity;
    
    fragColor = vec4(result, 1.0);
}
```

### 5. Detail Adjustments Shader

**File:** `src/engine/shaders/detail.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform float u_sharpening;    // 0.0 to 1.5
uniform float u_noiseRedLuma;  // 0.0 to 1.0
uniform float u_noiseRedColor; // 0.0 to 1.0

// Unsharp mask for sharpening
vec3 applySharpen(sampler2D tex, vec2 uv, float amount) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    
    vec3 center = texture(tex, uv).rgb;
    
    // 3x3 Laplacian kernel for edge detection
    vec3 blur = vec3(0.0);
    blur += texture(tex, uv + vec2(-1, -1) * texelSize).rgb;
    blur += texture(tex, uv + vec2( 0, -1) * texelSize).rgb * 2.0;
    blur += texture(tex, uv + vec2( 1, -1) * texelSize).rgb;
    blur += texture(tex, uv + vec2(-1,  0) * texelSize).rgb * 2.0;
    blur += texture(tex, uv + vec2( 1,  0) * texelSize).rgb * 2.0;
    blur += texture(tex, uv + vec2(-1,  1) * texelSize).rgb;
    blur += texture(tex, uv + vec2( 0,  1) * texelSize).rgb * 2.0;
    blur += texture(tex, uv + vec2( 1,  1) * texelSize).rgb;
    blur /= 12.0;
    
    vec3 sharpened = center + (center - blur) * amount;
    return sharpened;
}

// Bilateral filter for noise reduction
vec3 applyNoiseReduction(sampler2D tex, vec2 uv, float lumaAmount, float colorAmount) {
    vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));
    vec3 center = texture(tex, uv).rgb;
    float centerLum = getLuminance(center);
    
    vec3 sum = center;
    float weightSum = 1.0;
    
    // 5x5 bilateral filter
    for (float y = -2.0; y <= 2.0; y += 1.0) {
        for (float x = -2.0; x <= 2.0; x += 1.0) {
            if (x == 0.0 && y == 0.0) continue;
            
            vec2 offset = vec2(x, y) * texelSize;
            vec3 sampleColor = texture(tex, uv + offset).rgb;
            float sampleLum = getLuminance(sampleColor);
            
            // Spatial weight
            float spatialDist = length(vec2(x, y));
            float spatialWeight = exp(-spatialDist * spatialDist / 8.0);
            
            // Luminance weight (for luma noise reduction)
            float lumaDist = abs(sampleLum - centerLum);
            float lumaWeight = exp(-lumaDist * lumaDist / (lumaAmount * 0.1));
            
            // Color weight (for color noise reduction)
            vec3 colorDist = sampleColor - center;
            float colorDistSq = dot(colorDist, colorDist);
            float colorWeight = exp(-colorDistSq / (colorAmount * 0.1));
            
            float weight = spatialWeight * lumaWeight * colorWeight;
            sum += sampleColor * weight;
            weightSum += weight;
        }
    }
    
    return sum / weightSum;
}

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Apply noise reduction first
    if (u_noiseRedLuma > 0.0 || u_noiseRedColor > 0.0) {
        color = applyNoiseReduction(u_texture, v_texCoord, u_noiseRedLuma, u_noiseRedColor);
    }
    
    // Apply sharpening
    if (u_sharpening > 0.0) {
        color = applySharpen(u_texture, v_texCoord, u_sharpening);
    }
    
    fragColor = vec4(color, 1.0);
}
```

### 6. Final Output Shader (Tone Mapping + sRGB)

**File:** `src/engine/shaders/output.glsl`

```glsl
#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform bool u_enableToneMapping;

// Reinhard tone mapping
vec3 reinhardToneMap(vec3 color) {
    return color / (color + vec3(1.0));
}

// ACES filmic tone mapping (optional, higher quality)
vec3 acesToneMap(vec3 color) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Apply tone mapping if enabled (for HDR content)
    if (u_enableToneMapping) {
        color = reinhardToneMap(color);
    }
    
    // Clamp before gamma correction
    color = clamp(color, 0.0, 1.0);
    
    // Convert from linear to sRGB for display
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
}
```

## Implementation Strategy

### Phase 1: Core Color Pipeline (Week 1)
1. Implement color space conversion utilities
2. Update tonal shader with proper linear math
3. Update color shader with accurate temperature/tint
4. Test with reference images

### Phase 2: Multi-Pass Effects (Week 2)
1. Implement framebuffer manager for render targets
2. Add Gaussian blur shader
3. Implement clarity as two-pass effect
4. Add sharpening with unsharp mask

### Phase 3: Optimization & Polish (Week 3)
1. Add framebuffer pooling
2. Implement preview downscaling
3. Add performance monitoring
4. Optimize shader code

### Phase 4: Testing & Calibration (Week 4)
1. Compare with Lightroom reference images
2. Calibrate adjustment ranges
3. Add unit tests
4. Performance profiling

## Data Structures

### Shader Uniform Interface

```typescript
interface TonalUniforms {
  exposure: number;      // -5.0 to +5.0
  contrast: number;      // 0.0 to 2.0
  highlights: number;    // -1.0 to +1.0
  shadows: number;       // -1.0 to +1.0
  whites: number;        // -1.0 to +1.0
  blacks: number;        // -1.0 to +1.0
}

interface ColorUniforms {
  temperature: number;   // -100 to +100
  tint: number;          // -100 to +100
  vibrance: number;      // -1.0 to +1.0
  saturation: number;    // -1.0 to +1.0
}

interface DetailUniforms {
  sharpening: number;    // 0.0 to 1.5
  clarity: number;       // 0.0 to 1.0
  noiseRedLuma: number;  // 0.0 to 1.0
  noiseRedColor: number; // 0.0 to 1.0
}
```

### Framebuffer Manager

```typescript
class FramebufferManager {
  private pool: Map<string, WebGLFramebuffer>;
  private textures: Map<string, WebGLTexture>;
  
  getFramebuffer(width: number, height: number, format: 'rgba16f' | 'rgba8'): {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  };
  
  releaseFramebuffer(key: string): void;
  clearPool(): void;
}
```

## Performance Targets

| Operation | Target Time | Max Time |
|-----------|-------------|----------|
| Single adjustment | < 16ms | 33ms |
| Multi-pass effect | < 33ms | 50ms |
| Full pipeline | < 50ms | 100ms |
| Export (full res) | < 2s | 5s |

## Testing Strategy

### Reference Images
- Use Lightroom-processed images as ground truth
- Compare pixel-by-pixel with tolerance
- Test with various image types (portraits, landscapes, high-contrast)

### Unit Tests
- Color space conversion accuracy
- Exposure calculation correctness
- Tone mapping behavior
- Edge cases (black, white, saturated colors)

### Performance Tests
- Frame rate monitoring
- Memory usage tracking
- Shader compilation time
- Texture upload time

## Fallback Strategy

1. **WebGL2 unavailable** → Use WebGL1 with reduced precision
2. **Float textures unsupported** → Use RGBA8 with dithering
3. **Multi-pass fails** → Fall back to single-pass approximations
4. **WebGL fails completely** → Use Canvas 2D with basic adjustments

## Migration Path

1. Create new shader files alongside existing ones
2. Add feature flag to switch between old/new pipeline
3. Test thoroughly with both pipelines
4. Gradually migrate users to new pipeline
5. Remove old pipeline after validation

---

This design provides production-ready, Lightroom-quality shader code that can be directly implemented in Pixaro.
