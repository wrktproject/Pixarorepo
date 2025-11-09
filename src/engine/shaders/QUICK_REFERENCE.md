# Shader Composition System - Quick Reference

## Import & Use

```typescript
import { composeShader } from '@/engine/shaderComposer';

const shader = composeShader(`
    #include "colorSpaceUtils"
    void main() { /* ... */ }
`);
```

## Available Modules

| Module | Functions | Use For |
|--------|-----------|---------|
| `colorSpaceUtils` | sRGBToLinear, linearToSRGB, rgbToHSL, hslToRGB, getLuminance | Color space conversions |
| `mathUtils` | smoothCurve, lerp, highlightMask, shadowMask, clamp01 | Math operations, masking |
| `toneMappingUtils` | reinhardToneMap, acesToneMap, needsToneMapping | HDR tone mapping |
| `blurUtils` | gaussianBlur9, bilateralFilter, unsharpMask | Blur and sharpening |

## Common Patterns

### Color Processing
```glsl
#include "colorSpaceUtils"

vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
// ... process in linear space ...
color = linearToSRGB(clamp01(color));
```

### Luminance Masking
```glsl
#include "colorSpaceUtils"
#include "mathUtils"

float lum = getLuminance(color);
float mask = highlightMask(lum, 0.7, 0.3);
color *= (1.0 + adjustment * mask);
```

### Tone Mapping
```glsl
#include "toneMappingUtils"

if (needsToneMapping(color)) {
    color = acesToneMap(color);
}
```

### Blur
```glsl
#include "blurUtils"

vec3 blurred = gaussianBlur9(
    u_texture, v_texCoord,
    vec2(1.0, 0.0),  // direction
    2.0              // radius
);
```

## Naming Conventions

- **Uniforms**: `u_texture`, `u_exposure`
- **Attributes**: `a_position`, `a_texCoord`
- **Varyings**: `v_texCoord`, `v_normal`
- **Functions**: `camelCase` (getX, applyX, xToY)
- **Constants**: `UPPER_SNAKE_CASE`

## Shader Template

```glsl
/**
 * Shader Name
 * Description
 * 
 * @module shaderName
 * @version 1.0.0
 * @requires colorSpaceUtils
 */

#version 300 es
precision highp float;

// Includes
#include "colorSpaceUtils"
#include "mathUtils"

// Inputs
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_texture;
uniform float u_parameter;

// Output
out vec4 fragColor;

// Constants
const float MAX_VALUE = 2.0;

/**
 * Function description
 * @param input - Description [range]
 * @return Description [range]
 */
vec3 myFunction(vec3 input) {
    return input;
}

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    // ... processing ...
    fragColor = vec4(color, 1.0);
}
```

## TypeScript Integration

```typescript
import { composeShader, ShaderComposer } from '@/engine/shaderComposer';

// Quick composition
const shader = composeShader(source);

// With options
const composer = new ShaderComposer({
    enableCache: true,
    validate: true,
    debug: false
});

const shader = composer.createShader(fragmentSource, [
    'colorSpaceUtils',
    'mathUtils'
]);
```

## Debugging

```typescript
// Enable debug mode
const composer = new ShaderComposer({ debug: true });
const shader = composer.compose(source);
console.log(shader);  // Shows include boundaries

// Check cache
const stats = composer.getCacheStats();
console.log(`Cached: ${stats.cached}`);
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Module not found | Check registration in `shaderComposer.ts` |
| Circular dependency | Refactor to remove circular includes |
| Compilation error | Enable debug mode, check composed output |
| Slow performance | Enable caching, compose once |

## Resources

- [Full Documentation](./README.md)
- [Usage Guide](./USAGE_GUIDE.md)
- [Conventions](./SHADER_CONVENTIONS.md)
- [Example](./tonalComposed.example.ts)
