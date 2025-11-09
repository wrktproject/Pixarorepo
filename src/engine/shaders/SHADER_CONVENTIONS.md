# Shader Naming Conventions & Style Guide

This document defines the naming conventions and coding standards for all GLSL shaders in the Pixaro project.

**Requirement 15.3**: Use consistent naming conventions for uniforms and variables

## Table of Contents

1. [File Organization](#file-organization)
2. [Naming Conventions](#naming-conventions)
3. [Code Style](#code-style)
4. [Documentation](#documentation)
5. [Module System](#module-system)

---

## File Organization

### Directory Structure

```
src/engine/shaders/
├── lib/                    # Reusable shader libraries
│   ├── colorSpaceUtils.glsl
│   ├── mathUtils.glsl
│   ├── toneMappingUtils.glsl
│   └── blurUtils.glsl
├── base.ts                 # Base vertex/fragment shaders
├── tonal.ts                # Tonal adjustment shaders
├── color.ts                # Color adjustment shaders
├── detail.ts               # Detail/sharpening shaders
├── effects.ts              # Effects (vignette, grain)
├── output.ts               # Final output shader
└── SHADER_CONVENTIONS.md   # This file
```

### File Naming

- **TypeScript files**: `camelCase.ts` (e.g., `tonalAdjustments.ts`)
- **GLSL library files**: `camelCase.glsl` (e.g., `colorSpaceUtils.glsl`)
- **Test files**: `camelCase.test.ts` (e.g., `tonalAdjustments.test.ts`)

---

## Naming Conventions

### Uniforms

All uniforms use the `u_` prefix followed by camelCase:

```glsl
uniform sampler2D u_texture;
uniform float u_exposure;
uniform vec2 u_resolution;
uniform mat4 u_transformMatrix;
```

**Standard uniform names:**
- `u_texture` - Primary input texture
- `u_resolution` - Viewport/texture resolution
- `u_time` - Animation time
- Adjustment parameters: `u_exposure`, `u_contrast`, `u_saturation`, etc.

### Attributes

All vertex attributes use the `a_` prefix followed by camelCase:

```glsl
in vec2 a_position;
in vec2 a_texCoord;
in vec3 a_normal;
in vec4 a_color;
```

**Standard attribute names:**
- `a_position` - Vertex position
- `a_texCoord` - Texture coordinates
- `a_normal` - Vertex normal
- `a_color` - Vertex color

### Varyings

All varyings (vertex shader outputs / fragment shader inputs) use the `v_` prefix:

```glsl
out vec2 v_texCoord;
out vec3 v_normal;
out vec4 v_color;
```

### Functions

Functions use camelCase with descriptive names:

```glsl
vec3 sRGBToLinear(vec3 srgb) { ... }
float getLuminance(vec3 color) { ... }
vec3 applyToneMapping(vec3 color) { ... }
```

**Function naming patterns:**
- Converters: `xToY()` (e.g., `sRGBToLinear`, `rgbToHSL`)
- Getters: `getX()` (e.g., `getLuminance`, `getPerceivedBrightness`)
- Appliers: `applyX()` (e.g., `applyExposure`, `applyContrast`)
- Calculators: `calculateX()` (e.g., `calculateBlurRadius`)

### Constants

Constants use UPPER_SNAKE_CASE:

```glsl
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const vec3 REC709_LUMINANCE = vec3(0.2126, 0.7152, 0.0722);
const float GAMMA = 2.2;
```

### Local Variables

Local variables use camelCase:

```glsl
void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    float luminance = getLuminance(color);
    vec3 adjustedColor = applyExposure(color, u_exposure);
}
```

### Struct Names

Struct names use PascalCase:

```glsl
struct Material {
    vec3 albedo;
    float roughness;
    float metallic;
};

struct Light {
    vec3 position;
    vec3 color;
    float intensity;
};
```

---

## Code Style

### Indentation

- Use **4 spaces** for indentation (no tabs)
- Align braces consistently

```glsl
void main() {
    if (condition) {
        doSomething();
    } else {
        doSomethingElse();
    }
}
```

### Line Length

- Maximum **100 characters** per line
- Break long lines at logical points

```glsl
// Good
vec3 result = mix(
    colorA,
    colorB,
    smoothstep(0.0, 1.0, factor)
);

// Avoid
vec3 result = mix(colorA, colorB, smoothstep(0.0, 1.0, factor));
```

### Spacing

- Space after keywords: `if (`, `for (`, `while (`
- Space around operators: `a + b`, `x = y`, `a < b`
- No space before semicolons: `float x;`

```glsl
// Good
if (x > 0.0) {
    y = x * 2.0 + 1.0;
}

// Avoid
if(x>0.0){
    y=x*2.0+1.0;
}
```

### Precision Qualifiers

Always specify precision in fragment shaders:

```glsl
#version 300 es
precision highp float;  // Use highp for color processing
```

**Precision guidelines:**
- `highp` - Color processing, coordinates, critical calculations
- `mediump` - Less critical calculations, acceptable precision loss
- `lowp` - Flags, boolean-like values

---

## Documentation

### File Headers

Every shader file should have a header comment:

```glsl
/**
 * Module Name
 * 
 * Brief description of what this shader/module does.
 * 
 * @module moduleName
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */
```

### Function Documentation

Document all public functions:

```glsl
/**
 * Brief description of what the function does
 * 
 * More detailed explanation if needed. Explain the algorithm,
 * any special considerations, or references to papers/standards.
 * 
 * @param paramName - Description of parameter
 * @param anotherParam - Description [valid range]
 * @return Description of return value [range]
 */
vec3 functionName(vec3 paramName, float anotherParam) {
    // Implementation
}
```

### Section Comments

Use section dividers for organization:

```glsl
// ============================================================================
// Section Name
// ============================================================================

// Functions in this section...
```

### Inline Comments

- Explain **why**, not **what**
- Use `//` for single-line comments
- Keep comments concise and relevant

```glsl
// Good: Explains why
// Use Rec. 709 coefficients for HDTV standard
float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

// Avoid: States the obvious
// Calculate luminance
float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
```

---

## Module System

### Include Directives

Use `#include` to import library modules:

```glsl
#version 300 es
precision highp float;

// Include required libraries
#include "colorSpaceUtils"
#include "mathUtils"

// Shader code...
```

### Module Dependencies

Document module dependencies in the header:

```glsl
/**
 * Tonal Adjustment Shader
 * 
 * @module tonal
 * @version 1.0.0
 * @requires colorSpaceUtils
 * @requires mathUtils
 */
```

### Creating New Modules

When creating a new library module:

1. Place in `src/engine/shaders/lib/`
2. Use `.glsl` extension
3. Add comprehensive documentation
4. Register in `shaderComposer.ts`
5. Follow naming conventions
6. Include usage examples in comments

---

## Examples

### Complete Shader Example

```glsl
/**
 * Example Adjustment Shader
 * 
 * Demonstrates proper naming conventions and style.
 * 
 * @module example
 * @version 1.0.0
 * @requires colorSpaceUtils
 */

#version 300 es
precision highp float;

// Include libraries
#include "colorSpaceUtils"

// Inputs
in vec2 v_texCoord;

// Uniforms
uniform sampler2D u_texture;
uniform float u_strength;

// Output
out vec4 fragColor;

// Constants
const float MAX_STRENGTH = 2.0;

/**
 * Apply example adjustment
 * 
 * @param color - Input color [0-1]
 * @param strength - Adjustment strength [0-2]
 * @return Adjusted color [0-1]
 */
vec3 applyAdjustment(vec3 color, float strength) {
    // Convert to linear space for accurate math
    vec3 linear = sRGBToLinear(color);
    
    // Apply adjustment
    vec3 adjusted = linear * strength;
    
    // Convert back to sRGB
    return linearToSRGB(adjusted);
}

void main() {
    // Sample input texture
    vec4 texColor = texture(u_texture, v_texCoord);
    
    // Apply adjustment
    vec3 result = applyAdjustment(
        texColor.rgb,
        clamp(u_strength, 0.0, MAX_STRENGTH)
    );
    
    // Output
    fragColor = vec4(result, texColor.a);
}
```

---

## Checklist for New Shaders

- [ ] File has proper header documentation
- [ ] All functions are documented
- [ ] Naming conventions followed (u_, a_, v_ prefixes)
- [ ] Consistent indentation (4 spaces)
- [ ] Precision qualifiers specified
- [ ] Include directives used for libraries
- [ ] Code is readable and well-commented
- [ ] No magic numbers (use named constants)
- [ ] Tested with reference images

---

## References

- [GLSL ES 3.00 Specification](https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [WebGL 2.0 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [Pixaro Design Document](.kiro/specs/advanced-shaders/design.md)

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintainer**: Pixaro Development Team
