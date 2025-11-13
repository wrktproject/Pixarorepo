# Image Processing Algorithms

This document describes the algorithms used in Pixaro, inspired by professional photo editing software like Darktable.

## Color Space Conversions

### Professional Color Space Library

The application now includes a comprehensive color space conversion library (`src/engine/colorspaces/`) with support for:

- **sRGB ↔ Linear RGB** (IEC 61966-2-1 standard)
- **RGB ↔ XYZ** (D50 and D65 illuminants)
- **XYZ ↔ Lab** (D50 illuminant)
- **Lab ↔ LCH** (cylindrical coordinates)
- **ProPhoto RGB** (wide-gamut working space)
- **DT UCS 2022** (Darktable Uniform Color Space for perceptual color grading)
- **JzAzBz** (HDR-capable perceptual color space)
- **Bradford Chromatic Adaptation** (accurate white balance)

### sRGB ↔ Linear RGB

We use the IEC 61966-2-1 standard for accurate sRGB conversion:

**Linear to sRGB:**
```
if (linear <= 0.0031308)
    sRGB = linear * 12.92
else
    sRGB = 1.055 * pow(linear, 1/2.4) - 0.055
```

**sRGB to Linear:**
```
if (sRGB <= 0.04045)
    linear = sRGB / 12.92
else
    linear = pow((sRGB + 0.055) / 1.055, 2.4)
```

This matches Darktable's implementation exactly.

### RGB ↔ XYZ Conversions

**D65 Illuminant (sRGB/Rec.709 primaries):**
- Used for standard display-referred workflows
- Matches sRGB color space white point

**D50 Illuminant:**
- Used for print and ProPhoto RGB workflows
- Bradford chromatic adaptation applied when converting between D65 and D50

### XYZ ↔ Lab (CIELAB)

Standard CIELAB color space with D50 illuminant:
- L: Lightness [0-100]
- a: Green-Red axis [-128 to 127]
- b: Blue-Yellow axis [-128 to 127]

### ProPhoto RGB

Wide-gamut working space for professional color grading:
- Larger color gamut than sRGB
- Gamma 1.8 transfer function
- Prevents color clipping during adjustments

### DT UCS 2022 (Darktable Uniform Color Space)

Perceptually uniform color space designed for color grading:
- J: Perceptual lightness
- C: Chroma (colorfulness)
- H: Hue angle

Used in Color Balance RGB module for per-zone color adjustments (shadows, midtones, highlights).

### JzAzBz

HDR-capable perceptual color space:
- Jz: Perceptual lightness (supports HDR values > 1.0)
- Az: Red-green opponent axis
- Bz: Yellow-blue opponent axis
- Uses PQ (Perceptual Quantizer) transfer function

Better perceptual uniformity than CIELAB, especially for HDR content.

### Bradford Chromatic Adaptation

Industry-standard method for white balance:
- Converts between different illuminants (e.g., D65 to D50)
- Preserves color appearance under different lighting
- Used for accurate temperature/tint adjustments

## Tonal Adjustments

### Exposure
- Photographic stops in linear color space
- +1 stop = 2x brightness, -1 stop = 0.5x brightness
- Formula: `color * pow(2.0, exposure)`

### Contrast
- Power function around 18% grey fulcrum (Darktable approach)
- Grey fulcrum = 0.1845 (photographic middle grey)
- Formula: `pow(color / fulcrum, gamma) * fulcrum`
- Gamma calculation: `1.0 / (1.0 + normalized_contrast)`

### Highlights/Shadows
- Luminance-based masking with smooth curves
- Highlights affect pixels with luminance > 0.7
- Shadows affect pixels with luminance < 0.3
- Uses smooth falloff for natural transitions

### Whites/Blacks
- Extreme tone adjustments
- Whites affect pixels with luminance > 0.85
- Blacks affect pixels with luminance < 0.15
- Finer control than highlights/shadows

## Color Adjustments

### Temperature
- Simulates different lighting conditions
- Cool (blue) to Warm (orange) shift
- Uses color matrices for accurate color rendering

### Tint
- Magenta/Green color cast correction
- Useful for correcting fluorescent lighting
- Complementary to temperature adjustment

### Saturation
- Uniform color intensity adjustment
- Inspired by Darktable's SAT_EFFECT = 2.0
- Applied in HSL color space
- Formula: `saturation * (1.0 + adjustment)`

### Vibrance
- Smart saturation that protects already-saturated colors
- Boosts muted colors more than vivid colors
- Formula: `saturation + adjustment * (1.0 - saturation)`
- Prevents skin tone oversaturation

## Detail Adjustments

### Sharpening
- Unsharp mask technique
- Applied in luminance channel only (prevents color fringing)
- Uses Laplacian kernel for edge detection
- Multi-pass rendering with Gaussian blur

### Clarity
- Local contrast enhancement
- High-pass filtering technique
- Two-pass rendering:
  1. Gaussian blur to extract low frequencies
  2. Subtract from original to get high frequencies
  3. Composite back with user-controlled intensity

### Noise Reduction
- Bilateral filtering (edge-preserving blur)
- Separate luminance and color noise reduction
- Preserves edges while smoothing noise
- Inspired by Darktable's profile-based approach

## Effects

### Vignette
- Radial darkening/lightening from center
- Adjustable amount, midpoint, and feather
- Applied in post-processing

### Grain
- Film grain simulation
- Adjustable amount and size (fine/medium/coarse)
- Adds texture for artistic effect

## Performance Optimizations

### Multi-Pass Rendering
- Complex effects split into multiple passes
- Uses framebuffer objects (FBOs) for intermediate results
- Enables effects like clarity and blur

### Texture Management
- 16-bit float textures for high dynamic range
- Automatic downscaling to 2048px for preview
- Full resolution for export

### Real-Time Rendering
- RequestAnimationFrame-based render loop
- Batches multiple slider changes
- Frame skipping if rendering is slow
- Shader compilation caching

## References

- **Darktable**: Open-source RAW photo processor (GPL v3)
- **IEC 61966-2-1**: sRGB color space standard
- **Rec. 709**: HDTV color space (used for RGB primaries)
- **Bilateral Filtering**: Tomasi & Manduchi, 1998
- **Unsharp Masking**: Traditional photographic technique

## Implementation Notes

All algorithms are implemented in WebGL shaders for GPU acceleration. The implementations are original work inspired by industry-standard techniques and open-source references.

For detailed shader code, see:
- `src/engine/shaders/tonal.ts` - Tonal adjustments
- `src/engine/shaders/color.ts` - Color adjustments
- `src/engine/shaders/detail.ts` - Sharpening and noise reduction
- `src/engine/shaders/clarityComposite.ts` - Clarity effect
- `src/engine/shaders/output.ts` - Tone mapping and output

---

**Last Updated**: 2024
**License**: MIT
