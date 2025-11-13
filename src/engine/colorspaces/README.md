# Color Space Conversion Library

Professional-grade color space conversions for scene-referred image processing, inspired by Darktable's color science.

## Overview

This library provides accurate color space transformations for WebGL-based image processing. All conversions are implemented as GLSL shader code for GPU acceleration.

## Supported Color Spaces

### Standard Color Spaces

- **sRGB** - Standard RGB color space for displays (IEC 61966-2-1)
- **Linear RGB** - Scene-referred linear light RGB
- **XYZ** - CIE XYZ color space (D50 and D65 illuminants)
- **Lab** - CIELAB perceptual color space (D50)
- **LCH** - Cylindrical representation of Lab (Lightness, Chroma, Hue)
- **ProPhoto RGB** - Wide-gamut working space

### Advanced Perceptual Spaces

- **DT UCS 2022** - Darktable Uniform Color Space for color grading
- **JzAzBz** - HDR-capable perceptual color space

## Usage

### In TypeScript

```typescript
import { 
  colorSpaceShaderLib,
  dtUCSShaderLib,
  jzAzBzShaderLib,
  allColorSpaceShadersGLSL,
  Illuminants,
  temperatureToXYZ
} from '@/engine/colorspaces';

// Use in shader compilation
const fragmentShader = `
  ${allColorSpaceShadersGLSL}
  
  void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Convert to linear space
    color = sRGBToLinear(color);
    
    // Do processing in linear space
    // ...
    
    // Convert back to sRGB
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
  }
`;

// Convert temperature to white point
const whitePoint = temperatureToXYZ(6500); // D65
```

### In GLSL Shaders

```glsl
// Include the library at the top of your shader
${allColorSpaceShadersGLSL}

void main() {
  vec3 color = texture(u_texture, v_texCoord).rgb;
  
  // sRGB to Linear
  color = sRGBToLinear(color);
  
  // Linear RGB to Lab
  vec3 lab = linearRGBToLab(color);
  
  // Adjust in Lab space
  lab.x *= 1.1; // Increase lightness
  
  // Lab back to Linear RGB
  color = labToLinearRGB(lab);
  
  // Linear to sRGB for display
  color = linearToSRGB(color);
  
  fragColor = vec4(color, 1.0);
}
```

## Color Space Workflows

### Scene-Referred Workflow (Recommended)

For professional color grading, use this workflow:

1. **Input**: sRGB → Linear RGB
2. **Processing**: Work in Linear RGB or ProPhoto RGB
3. **Color Grading**: Use DT UCS or JzAzBz for perceptual adjustments
4. **Output**: Linear RGB → sRGB

```glsl
// 1. Input conversion
vec3 linear = sRGBToLinear(srgbColor);

// 2. Convert to wide gamut if needed
vec3 prophoto = linearRGBToProPhotoRGB(linear);

// 3. Color grading in DT UCS
vec3 jch = linearRGBToDTUCS(prophoto);
jch.y *= 1.2; // Increase chroma
vec3 graded = dtucsToLinearRGB(jch);

// 4. Convert back to sRGB
vec3 output = linearToSRGB(graded);
```

### Display-Referred Workflow (Simple)

For basic adjustments:

1. **Input**: sRGB
2. **Processing**: Work in sRGB or HSL
3. **Output**: sRGB

## Key Functions

### Basic Conversions

- `sRGBToLinear(vec3)` - sRGB to linear RGB
- `linearToSRGB(vec3)` - Linear RGB to sRGB
- `linearRGBToXYZ_D65(vec3)` - RGB to XYZ (D65)
- `linearRGBToXYZ_D50(vec3)` - RGB to XYZ (D50)
- `xyzD65ToLinearRGB(vec3)` - XYZ (D65) to RGB
- `xyzD50ToLinearRGB(vec3)` - XYZ (D50) to RGB

### Lab Color Space

- `linearRGBToLab(vec3)` - RGB to Lab
- `labToLinearRGB(vec3)` - Lab to RGB
- `labToLCH(vec3)` - Lab to LCH (cylindrical)
- `lchToLab(vec3)` - LCH to Lab

### ProPhoto RGB

- `linearRGBToProPhotoRGB(vec3)` - Convert to ProPhoto RGB
- `proPhotoRGBToLinearRGB(vec3)` - Convert from ProPhoto RGB

### DT UCS 2022

- `linearRGBToDTUCS(vec3)` - RGB to DT UCS (JCH)
- `dtucsToLinearRGB(vec3)` - DT UCS to RGB
- `adjustChromaDTUCS(vec3, float)` - Adjust chroma
- `adjustLightnessDTUCS(vec3, float)` - Adjust lightness
- `rotateHueDTUCS(vec3, float)` - Rotate hue
- `colorGradeDTUCS(vec3, float, float, float)` - Full color grading

### JzAzBz

- `linearRGBToJzAzBz(vec3)` - RGB to JzAzBz
- `jzAzBzToLinearRGB(vec3)` - JzAzBz to RGB
- `applySaturationJzAzBz(vec3, float)` - Perceptual saturation
- `applyVibranceJzAzBz(vec3, float, float)` - Adaptive saturation with skin protection
- `adjustLightnessJzAzBz(vec3, float)` - Adjust lightness
- `rotateHueJzAzBz(vec3, float)` - Rotate hue

### Chromatic Adaptation

- `bradfordAdaptation(vec3, vec3, vec3)` - Bradford transform
- `temperatureToXYZ(float)` - Convert Kelvin to XYZ white point

### Utilities

- `getLuminance(vec3)` - Calculate Rec. 709 luminance
- `safeDivide(float, float, float)` - Safe division with fallback
- `safePow(float, float)` - Safe power function
- `clampPreserveHue(vec3)` - Clamp while preserving hue

## Color Balance RGB

The DT UCS module includes support for Color Balance RGB, a powerful color grading system:

```glsl
// Generate luminance masks
vec3 jch = linearRGBToDTUCS(rgb);
vec3 masks = generateLuminanceMasks(
  jch.x,           // Lightness
  0.1845,          // Grey fulcrum (18.45%)
  1.0,             // Shadows weight
  1.0              // Highlights weight
);

// Apply per-zone adjustments
vec3 graded = applyColorBalanceRGB(
  rgb,
  masks,
  vec3(0.0, 0.1, 0.0),  // Shadows: +chroma
  vec3(0.0, 0.0, 0.0),  // Midtones: no change
  vec3(0.0, -0.1, 0.0), // Highlights: -chroma
  vec3(0.0, 0.0, 0.0)   // Global: no change
);
```

## Standard Illuminants

```typescript
import { Illuminants } from '@/engine/colorspaces';

Illuminants.D50  // { x: 0.9642, y: 1.0000, z: 0.8249 }
Illuminants.D65  // { x: 0.9505, y: 1.0000, z: 1.0890 }
Illuminants.A    // { x: 1.0985, y: 1.0000, z: 0.3558 } - Incandescent
Illuminants.F2   // { x: 0.9929, y: 1.0000, z: 0.6733 } - Fluorescent
```

## Testing

The library includes comprehensive tests:

```bash
npm test src/engine/colorspaces
```

Tests cover:
- Round-trip accuracy (RGB → XYZ → RGB)
- Known reference values
- Edge cases (black, white, primaries)
- Temperature conversion accuracy
- Shader library completeness

## References

- **IEC 61966-2-1** - sRGB color space standard
- **CIE 1931** - XYZ color space
- **CIELAB** - Lab color space
- **Darktable** - DT UCS 2022 color space
- **Safdar et al. (2017)** - JzAzBz color space
- **Lam (1985)** - Bradford chromatic adaptation

## Performance Notes

- All conversions are GPU-accelerated via GLSL shaders
- Use `float16` textures where possible to save memory
- Combine multiple conversions in a single shader pass when possible
- Cache conversion results when processing the same image multiple times

## Future Enhancements

- [ ] Gamut mapping algorithms
- [ ] Additional perceptual spaces (Oklab, IPT)
- [ ] Color appearance models (CIECAM02)
- [ ] LUT-based conversions for performance
