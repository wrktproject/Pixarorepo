# Pixaro Shader Library

A modular, composable shader system for professional-grade image processing in WebGL2.

## Overview

The Pixaro shader library provides:

- **Modular Architecture**: Reusable shader utilities organized into focused modules
- **Include System**: Import shader functions using `#include` directives
- **Consistent Conventions**: Standardized naming and coding style across all shaders
- **Comprehensive Documentation**: Inline documentation for all functions and modules
- **Type Safety**: TypeScript integration for shader management

## Quick Start

### Basic Usage

```typescript
import { composeShader } from '../shaderComposer';

// Write shader with includes
const fragmentSource = `#version 300 es
precision highp float;

#include "colorSpaceUtils"
#include "mathUtils"

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Use functions from included libraries
    color = sRGBToLinear(color);
    float lum = getLuminance(color);
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
}
`;

// Compose shader (resolves includes)
const composedShader = composeShader(fragmentSource);
```

### Using the Shader Composer

```typescript
import { ShaderComposer } from '../shaderComposer';

const composer = new ShaderComposer({
    enableCache: true,
    validate: true,
    debug: false
});

// Create shader with specific includes
const shader = composer.createShader(fragmentSource, [
    'colorSpaceUtils',
    'mathUtils'
]);
```

## Available Modules

### colorSpaceUtils

Color space conversion utilities for accurate color processing.

**Functions:**
- `sRGBToLinear(vec3)` - Accurate sRGB to linear RGB conversion
- `linearToSRGB(vec3)` - Linear RGB to sRGB conversion
- `sRGBToLinearFast(vec3)` - Fast approximation (2-3x faster)
- `linearToSRGBFast(vec3)` - Fast approximation
- `rgbToHSL(vec3)` - RGB to HSL color space
- `hslToRGB(vec3)` - HSL to RGB color space
- `getLuminance(vec3)` - Calculate luminance (Rec. 709)
- `getPerceivedBrightness(vec3)` - Perceived brightness

**Example:**
```glsl
#include "colorSpaceUtils"

vec3 color = texture(u_texture, v_texCoord).rgb;
color = sRGBToLinear(color);  // Convert to linear for processing
// ... do processing ...
color = linearToSRGB(color);  // Convert back for display
```

### mathUtils

Mathematical utilities for image processing.

**Functions:**
- `smoothCurve(float, float, float)` - Smooth transition curve
- `smoothCurveAdjustable(float, float, float, float)` - Adjustable falloff
- `smootherstep(float, float, float)` - Hermite interpolation
- `sCurve(float, float)` - S-curve for contrast
- `lerp(float, float, float)` - Linear interpolation
- `lerp3(vec3, vec3, float)` - Vec3 interpolation
- `remap(float, float, float, float, float)` - Range remapping
- `highlightMask(float, float, float)` - Luminance-based highlight mask
- `shadowMask(float, float, float)` - Luminance-based shadow mask
- `saturationMask(float, float, float)` - Saturation-based mask

**Example:**
```glsl
#include "mathUtils"

float lum = getLuminance(color);
float mask = highlightMask(lum, 0.7, 0.3);  // Mask for bright areas
color *= (1.0 + adjustment * mask);
```

### toneMappingUtils

Tone mapping algorithms for HDR to LDR conversion.

**Functions:**
- `reinhardToneMap(vec3)` - Simple Reinhard tone mapping
- `reinhardToneMapLuminance(vec3, float)` - Luminance-based Reinhard
- `acesToneMap(vec3)` - ACES filmic tone mapping
- `uncharted2ToneMap(vec3)` - Uncharted 2 tone mapping
- `exposureToneMap(vec3, float)` - Exposure-based tone mapping
- `photographicToneMap(vec3, float, float)` - Photographic tone mapping
- `applyToneMapping(vec3, bool, int)` - Conditional tone mapping
- `needsToneMapping(vec3)` - Check if HDR content

**Example:**
```glsl
#include "toneMappingUtils"

vec3 hdrColor = processImage(color);
if (needsToneMapping(hdrColor)) {
    hdrColor = acesToneMap(hdrColor);
}
```

### blurUtils

Blur and filtering algorithms.

**Functions:**
- `gaussianBlur5(sampler2D, vec2, vec2, float)` - 5-tap Gaussian blur
- `gaussianBlur9(sampler2D, vec2, vec2, float)` - 9-tap Gaussian blur
- `gaussianBlur13(sampler2D, vec2, vec2, float)` - 13-tap Gaussian blur
- `boxBlur(sampler2D, vec2, float)` - Simple box blur
- `bilateralFilter(sampler2D, vec2, float, float, float)` - Edge-preserving blur
- `unsharpMask(vec3, vec3, float)` - Sharpening via unsharp mask

**Example:**
```glsl
#include "blurUtils"

// Horizontal blur pass
vec3 blurred = gaussianBlur9(u_texture, v_texCoord, vec2(1.0, 0.0), 2.0);

// Sharpen using unsharp mask
vec3 sharpened = unsharpMask(original, blurred, 0.5);
```

## Directory Structure

```
src/engine/shaders/
├── lib/                          # Shader library modules
│   ├── colorSpaceUtils.glsl      # Color space conversions
│   ├── mathUtils.glsl            # Math utilities
│   ├── toneMappingUtils.glsl     # Tone mapping
│   └── blurUtils.glsl            # Blur algorithms
├── base.ts                       # Base shaders
├── tonal.ts                      # Tonal adjustments
├── color.ts                      # Color adjustments
├── detail.ts                     # Detail/sharpening
├── effects.ts                    # Effects (vignette, grain)
├── output.ts                     # Final output
├── tonalComposed.example.ts      # Example using composition
├── SHADER_CONVENTIONS.md         # Naming conventions
└── README.md                     # This file
```

## Naming Conventions

### Uniforms
- Prefix: `u_`
- Example: `u_texture`, `u_exposure`, `u_resolution`

### Attributes
- Prefix: `a_`
- Example: `a_position`, `a_texCoord`, `a_normal`

### Varyings
- Prefix: `v_`
- Example: `v_texCoord`, `v_normal`, `v_color`

### Functions
- camelCase
- Patterns:
  - Converters: `xToY()` (e.g., `sRGBToLinear`)
  - Getters: `getX()` (e.g., `getLuminance`)
  - Appliers: `applyX()` (e.g., `applyExposure`)

### Constants
- UPPER_SNAKE_CASE
- Example: `PI`, `TWO_PI`, `REC709_LUMINANCE`

See [SHADER_CONVENTIONS.md](./SHADER_CONVENTIONS.md) for complete style guide.

## Creating New Modules

### 1. Create Module File

Create a new `.glsl` file in `src/engine/shaders/lib/`:

```glsl
/**
 * My Custom Module
 * 
 * Description of what this module does.
 * 
 * @module myModule
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

// ============================================================================
// Section Name
// ============================================================================

/**
 * Function description
 * 
 * @param input - Description
 * @return Description
 */
float myFunction(float input) {
    return input * 2.0;
}
```

### 2. Register Module

Add to `shaderComposer.ts`:

```typescript
import myModuleGLSL from './shaders/lib/myModule.glsl?raw';

// In registerBuiltInModules():
this.registerModule({
    name: 'myModule',
    source: myModuleGLSL,
    dependencies: [],
    version: '1.0.0',
    description: 'My custom module',
});
```

### 3. Use Module

```glsl
#include "myModule"

void main() {
    float result = myFunction(1.0);
}
```

## Best Practices

### 1. Always Use Linear Color Space

```glsl
// ✓ Good
vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
color = color * 2.0;  // Process in linear space
color = linearToSRGB(color);

// ✗ Bad
vec3 color = texture(u_texture, v_texCoord).rgb;
color = color * 2.0;  // Wrong! Processing in sRGB space
```

### 2. Use Masking for Selective Adjustments

```glsl
// ✓ Good - Affects only highlights
float lum = getLuminance(color);
float mask = highlightMask(lum, 0.7, 0.3);
color *= (1.0 + adjustment * mask);

// ✗ Bad - Affects entire image uniformly
color *= (1.0 + adjustment);
```

### 3. Clamp Values Appropriately

```glsl
// ✓ Good
color = clamp01(color);  // Clamp to [0-1]

// ✗ Bad - Can cause artifacts
// (no clamping)
```

### 4. Document Your Shaders

```glsl
/**
 * Apply custom adjustment
 * 
 * Detailed explanation of what this does and why.
 * 
 * @param color - Input color [0-1]
 * @param strength - Adjustment strength [0-2]
 * @return Adjusted color [0-1]
 */
vec3 applyAdjustment(vec3 color, float strength) {
    // Implementation
}
```

## Performance Tips

### 1. Use Fast Approximations When Appropriate

```glsl
// For preview (fast)
color = sRGBToLinearFast(color);

// For export (accurate)
color = sRGBToLinear(color);
```

### 2. Minimize Texture Lookups

```glsl
// ✓ Good - Single lookup
vec3 color = texture(u_texture, v_texCoord).rgb;
float lum = getLuminance(color);

// ✗ Bad - Multiple lookups
float lum = getLuminance(texture(u_texture, v_texCoord).rgb);
vec3 color = texture(u_texture, v_texCoord).rgb;
```

### 3. Use Separable Filters

```glsl
// ✓ Good - Two passes (O(n))
vec3 blurred = gaussianBlur9(u_texture, v_texCoord, vec2(1.0, 0.0), radius);
// Then vertical pass in next shader

// ✗ Bad - Single 2D pass (O(n²))
// (much slower for large kernels)
```

## Testing

Run shader composition tests:

```bash
npm test shaderComposer.test.ts
```

## Troubleshooting

### Include Not Found

```
Error: Shader module "moduleName" not found
```

**Solution**: Ensure module is registered in `shaderComposer.ts`

### Circular Dependency

```
Error: Circular dependency detected: moduleA -> moduleB -> moduleA
```

**Solution**: Refactor modules to remove circular references

### Compilation Error

```
Error: fragment shader compilation failed
```

**Solution**: Check composed shader output with debug mode:

```typescript
const composer = new ShaderComposer({ debug: true });
const composed = composer.compose(source);
console.log(composed);  // Inspect output
```

## References

- [GLSL ES 3.00 Specification](https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [WebGL 2.0 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [Shader Conventions](./SHADER_CONVENTIONS.md)
- [Design Document](../../.kiro/specs/advanced-shaders/design.md)

## Contributing

When adding new shader modules:

1. Follow naming conventions
2. Add comprehensive documentation
3. Include usage examples
4. Write tests
5. Update this README

---

**Version**: 1.0.0  
**License**: MIT  
**Maintainer**: Pixaro Development Team
