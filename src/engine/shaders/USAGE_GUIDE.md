# Shader Composition System - Usage Guide

This guide provides practical examples and patterns for using the Pixaro shader composition system.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Common Patterns](#common-patterns)
3. [Advanced Techniques](#advanced-techniques)
4. [Migration Guide](#migration-guide)
5. [Troubleshooting](#troubleshooting)

---

## Basic Usage

### Example 1: Simple Color Adjustment Shader

```typescript
import { composeShader } from '@/engine/shaderComposer';

const fragmentSource = `#version 300 es
precision highp float;

// Include color space utilities
#include "colorSpaceUtils"

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_brightness;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Convert to linear space
    color = sRGBToLinear(color);
    
    // Apply brightness
    color *= u_brightness;
    
    // Convert back to sRGB
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
}
`;

// Compose the shader (resolves #include directives)
const composedShader = composeShader(fragmentSource);

// Use with WebGL
const program = createShaderProgram(gl, vertexShader, composedShader);
```

### Example 2: Using Multiple Libraries

```typescript
const fragmentSource = `#version 300 es
precision highp float;

// Include multiple libraries
#include "colorSpaceUtils"
#include "mathUtils"
#include "toneMappingUtils"

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_exposure;
uniform bool u_enableToneMapping;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Convert to linear
    color = sRGBToLinear(color);
    
    // Apply exposure
    color *= pow(2.0, u_exposure);
    
    // Apply tone mapping if needed
    if (u_enableToneMapping && needsToneMapping(color)) {
        color = acesToneMap(color);
    }
    
    // Clamp and convert back
    color = clamp01(color);
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
}
`;

const composedShader = composeShader(fragmentSource);
```

---

## Common Patterns

### Pattern 1: Tonal Adjustments with Masking

```glsl
#include "colorSpaceUtils"
#include "mathUtils"

uniform float u_highlights;
uniform float u_shadows;

void main() {
    vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
    float lum = getLuminance(color);
    
    // Adjust highlights (bright areas)
    float highlightsMask = highlightMask(lum, 0.7, 0.3);
    color *= (1.0 + (u_highlights / 100.0) * highlightsMask);
    
    // Adjust shadows (dark areas)
    float shadowsMask = shadowMask(lum, 0.3, 0.3);
    color *= (1.0 + (u_shadows / 100.0) * shadowsMask);
    
    color = linearToSRGB(clamp01(color));
    fragColor = vec4(color, 1.0);
}
```

### Pattern 2: Color Grading with HSL

```glsl
#include "colorSpaceUtils"

uniform float u_hueShift;
uniform float u_saturation;
uniform float u_lightness;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Convert to HSL
    vec3 hsl = rgbToHSL(color);
    
    // Adjust HSL components
    hsl.x = fract(hsl.x + u_hueShift);  // Hue shift
    hsl.y = clamp(hsl.y * u_saturation, 0.0, 1.0);  // Saturation
    hsl.z = clamp(hsl.z + u_lightness, 0.0, 1.0);  // Lightness
    
    // Convert back to RGB
    color = hslToRGB(hsl);
    
    fragColor = vec4(color, 1.0);
}
```

### Pattern 3: Multi-Pass Blur Effect

**Pass 1: Horizontal Blur**
```glsl
#include "blurUtils"

uniform vec2 u_resolution;
uniform float u_radius;

void main() {
    vec3 blurred = gaussianBlur9(
        u_texture,
        v_texCoord,
        vec2(1.0, 0.0),  // Horizontal direction
        u_radius
    );
    fragColor = vec4(blurred, 1.0);
}
```

**Pass 2: Vertical Blur**
```glsl
#include "blurUtils"

uniform vec2 u_resolution;
uniform float u_radius;

void main() {
    vec3 blurred = gaussianBlur9(
        u_texture,
        v_texCoord,
        vec2(0.0, 1.0),  // Vertical direction
        u_radius
    );
    fragColor = vec4(blurred, 1.0);
}
```

### Pattern 4: Clarity Effect (Unsharp Mask)

```glsl
#include "blurUtils"

uniform sampler2D u_original;
uniform sampler2D u_blurred;
uniform float u_clarity;

void main() {
    vec3 original = texture(u_original, v_texCoord).rgb;
    vec3 blurred = texture(u_blurred, v_texCoord).rgb;
    
    // Apply unsharp mask
    vec3 sharpened = unsharpMask(original, blurred, u_clarity);
    
    fragColor = vec4(sharpened, 1.0);
}
```

---

## Advanced Techniques

### Custom Module Registration

```typescript
import { shaderComposer, type ShaderModule } from '@/engine/shaderComposer';

// Define custom module
const customModule: ShaderModule = {
    name: 'myCustomUtils',
    source: `
        float myCustomFunction(float x) {
            return x * x;
        }
        
        vec3 myColorTransform(vec3 color) {
            return color * 0.5 + 0.5;
        }
    `,
    dependencies: [],
    version: '1.0.0',
    description: 'My custom utility functions',
};

// Register module
shaderComposer.registerModule(customModule);

// Use in shader
const shader = composeShader(`
    #include "myCustomUtils"
    
    void main() {
        float value = myCustomFunction(1.0);
        vec3 color = myColorTransform(texture(u_texture, v_texCoord).rgb);
        fragColor = vec4(color, 1.0);
    }
`);
```

### Conditional Includes

```typescript
import { ShaderComposer } from '@/engine/shaderComposer';

const composer = new ShaderComposer();

// Build shader with conditional includes
function createAdjustmentShader(options: {
    useColorSpace: boolean;
    useToneMapping: boolean;
    useBlur: boolean;
}) {
    const includes: string[] = [];
    
    if (options.useColorSpace) includes.push('colorSpaceUtils');
    if (options.useToneMapping) includes.push('toneMappingUtils');
    if (options.useBlur) includes.push('blurUtils');
    
    const fragmentSource = `
        void main() {
            vec3 color = texture(u_texture, v_texCoord).rgb;
            // ... shader code ...
            fragColor = vec4(color, 1.0);
        }
    `;
    
    return composer.createShader(fragmentSource, includes);
}
```

### Debug Mode for Development

```typescript
import { ShaderComposer } from '@/engine/shaderComposer';

// Enable debug mode during development
const debugComposer = new ShaderComposer({
    debug: true,
    validate: true,
});

const shader = debugComposer.compose(`
    #include "colorSpaceUtils"
    void main() { /* ... */ }
`);

// Output will include debug comments:
// ============================================================================
// BEGIN INCLUDE: colorSpaceUtils (v1.0.0)
// Color space conversion utilities (sRGB, linear, HSL)
// ============================================================================
// ... module code ...
// ============================================================================
// END INCLUDE: colorSpaceUtils
// ============================================================================
```

### Performance Optimization with Caching

```typescript
import { ShaderComposer } from '@/engine/shaderComposer';

// Enable caching for production
const cachedComposer = new ShaderComposer({
    enableCache: true,
});

// First call: composes and caches
const shader1 = cachedComposer.compose(shaderSource);

// Second call: returns cached result (much faster)
const shader2 = cachedComposer.compose(shaderSource);

// Check cache statistics
const stats = cachedComposer.getCacheStats();
console.log(`Cached shaders: ${stats.cached}`);
```

---

## Migration Guide

### Migrating Existing Shaders

**Before (without composition system):**

```typescript
// tonal.ts
export const tonalFragmentShader = `#version 300 es
precision highp float;

// Duplicate color space functions in every shader
vec3 sRGBToLinear(vec3 srgb) {
    // ... implementation ...
}

vec3 linearToSRGB(vec3 linear) {
    // ... implementation ...
}

float getLuminance(vec3 color) {
    // ... implementation ...
}

void main() {
    vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
    // ... adjustments ...
    color = linearToSRGB(color);
    fragColor = vec4(color, 1.0);
}
`;
```

**After (with composition system):**

```typescript
// tonal.ts
import { composeShader } from '@/engine/shaderComposer';

const tonalFragmentShaderSource = `#version 300 es
precision highp float;

// Include shared utilities (no duplication!)
#include "colorSpaceUtils"
#include "mathUtils"

void main() {
    vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
    // ... adjustments ...
    color = linearToSRGB(color);
    fragColor = vec4(color, 1.0);
}
`;

export const tonalFragmentShader = composeShader(tonalFragmentShaderSource);
```

### Step-by-Step Migration

1. **Identify duplicate code** across shaders
2. **Extract to library module** in `src/engine/shaders/lib/`
3. **Register module** in `shaderComposer.ts`
4. **Replace duplicates** with `#include` directives
5. **Compose shaders** using `composeShader()`
6. **Test thoroughly** to ensure behavior unchanged

---

## Troubleshooting

### Issue: "Shader module not found"

**Problem:**
```
Error: Shader module "myModule" not found
```

**Solution:**
1. Check module is registered in `shaderComposer.ts`
2. Verify module name matches exactly (case-sensitive)
3. Ensure module file is imported correctly

```typescript
// In shaderComposer.ts
import myModuleGLSL from './shaders/lib/myModule.glsl?raw';

this.registerModule({
    name: 'myModule',  // Must match #include name
    source: myModuleGLSL,
    // ...
});
```

### Issue: "Circular dependency detected"

**Problem:**
```
Error: Circular dependency detected: moduleA -> moduleB -> moduleA
```

**Solution:**
Refactor modules to remove circular references:

```glsl
// Bad: moduleA includes moduleB, moduleB includes moduleA
// moduleA.glsl
#include "moduleB"

// moduleB.glsl
#include "moduleA"

// Good: Extract shared code to moduleC
// moduleC.glsl (shared utilities)
float sharedFunction() { /* ... */ }

// moduleA.glsl
#include "moduleC"

// moduleB.glsl
#include "moduleC"
```

### Issue: Shader compilation fails after composition

**Problem:**
Composed shader fails to compile in WebGL.

**Solution:**
1. Enable debug mode to inspect output:
```typescript
const composer = new ShaderComposer({ debug: true });
const composed = composer.compose(source);
console.log(composed);
```

2. Check for:
   - Duplicate function definitions
   - Missing semicolons
   - Mismatched braces
   - GLSL version mismatches

3. Validate shader syntax:
```typescript
const composer = new ShaderComposer({ validate: true });
```

### Issue: Performance degradation

**Problem:**
Shader composition is slow.

**Solution:**
1. Enable caching:
```typescript
const composer = new ShaderComposer({ enableCache: true });
```

2. Compose shaders once at initialization, not per-frame:
```typescript
// Good: Compose once
const shader = composeShader(source);
const program = createProgram(gl, vertexShader, shader);

// Bad: Composing every frame
function render() {
    const shader = composeShader(source);  // Don't do this!
    // ...
}
```

---

## Best Practices Summary

1. ✓ **Always use linear color space** for processing
2. ✓ **Include only needed modules** to minimize shader size
3. ✓ **Enable caching** in production
4. ✓ **Use debug mode** during development
5. ✓ **Document custom modules** thoroughly
6. ✓ **Follow naming conventions** consistently
7. ✓ **Test composed shaders** with reference images
8. ✓ **Compose once**, use many times

---

## Additional Resources

- [Shader Library README](./README.md)
- [Naming Conventions](./SHADER_CONVENTIONS.md)
- [Design Document](../../.kiro/specs/advanced-shaders/design.md)
- [Example Shader](./tonalComposed.example.ts)

---

**Questions or Issues?**

Check the [troubleshooting section](#troubleshooting) or review the test file `shaderComposer.test.ts` for more examples.
