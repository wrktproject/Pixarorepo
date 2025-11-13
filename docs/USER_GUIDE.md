# Pixaro User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Interface](#understanding-the-interface)
3. [Tone Mapping Modules](#tone-mapping-modules)
4. [Color Grading](#color-grading)
5. [Detail Enhancement](#detail-enhancement)
6. [Workflows and Best Practices](#workflows-and-best-practices)
7. [Troubleshooting](#troubleshooting)

## Getting Started

### Loading an Image

1. Click the "Load Image" button or drag and drop an image onto the canvas
2. Supported formats: JPEG, PNG, TIFF, and RAW (CR2, NEF, ARW, DNG)
3. The image will be displayed in the main canvas area

### Basic Workflow

Pixaro uses a scene-referred workflow inspired by professional tools like Darktable:

1. **Input Transform**: Image is converted to linear RGB
2. **Scene-Referred Adjustments**: Exposure, white balance, color grading
3. **Tone Mapping**: Compress dynamic range for display (Filmic or Sigmoid)
4. **Display-Referred Adjustments**: Final touches, detail enhancement
5. **Output Transform**: Convert to sRGB for display/export

## Understanding the Interface

### Main Canvas

The main canvas displays your image with all adjustments applied in real-time.
- **Zoom**: Use mouse wheel or pinch gestures
- **Pan**: Click and drag to move around the image
- **Fit to Screen**: Double-click to reset view

### Adjustment Panels

Adjustment panels are organized by function:
- **Exposure**: Basic tonal adjustments
- **Tone Mapping**: Filmic RGB or Sigmoid
- **Color**: White balance, Color Balance RGB, Saturation
- **Detail**: Sharpening, local contrast, noise reduction
- **Effects**: Vignette, grain, and other creative effects

### Presets


Use presets to quickly apply professional looks:
- **Built-in Presets**: Film emulation, portrait, landscape, B&W
- **Custom Presets**: Save your own adjustment combinations
- **Preset Manager**: Organize and manage your presets

## Tone Mapping Modules

### When to Use Filmic vs Sigmoid

**Use Filmic RGB when:**
- You need maximum control over highlight and shadow rolloff
- Working with high dynamic range images
- You want film-like highlight compression
- You need independent control of shadows and highlights contrast
- Professional color grading is required

**Use Sigmoid when:**
- You want quick, pleasing results with minimal adjustment
- You prefer simpler controls (fewer parameters)
- You need excellent color preservation
- You're working with standard dynamic range images
- You want a classic S-curve look

**Note**: Only enable ONE tone mapping module at a time (Filmic OR Sigmoid, not both).

### Filmic RGB Tone Mapping

Filmic RGB provides professional-grade tone mapping with film-like characteristics.

#### Key Parameters

**White Point (EV)**
- Range: 0.5 to 8.0 EV
- Default: 4.0 EV
- Controls where highlights start to roll off
- Higher values preserve more highlight detail but reduce contrast
- Lower values create earlier rolloff with more contrast

**Black Point (EV)**
- Range: -8.0 to -0.5 EV
- Default: -8.0 EV
- Controls where shadows start to compress
- More negative values preserve shadow detail
- Less negative values create deeper blacks


**Latitude (%)**
- Range: 10% to 100%
- Default: 50%
- Controls midtone contrast
- Higher values = lower contrast (more linear)
- Lower values = higher contrast (steeper curve)

**Balance**
- Range: -50 to 50
- Default: 0
- Shifts balance between shadows and highlights
- Negative: favor shadow preservation
- Positive: favor highlight preservation

**Shadows/Highlights Contrast**
- **Hard**: Steep slope, strong contrast, punchy look
- **Soft**: Moderate slope, balanced contrast (recommended)
- **Safe**: Gentle slope, maximum detail preservation

#### Filmic Presets

- **Standard**: Balanced compression for general use
- **High Contrast**: Strong compression for dramatic look
- **Low Contrast**: Gentle compression for natural look

### Sigmoid Tone Mapping

Sigmoid provides simpler S-curve tone mapping with excellent color preservation.

#### Key Parameters

**Contrast**
- Range: 0.5 to 2.0
- Default: 1.0
- Controls steepness of the S-curve
- Higher values = more contrast
- Lower values = gentler curve

**Skew**
- Range: -1.0 to 1.0
- Default: 0.0
- Shifts curve to favor shadows or highlights
- Negative: preserve shadows, compress highlights more
- Positive: preserve highlights, compress shadows more

**Middle Grey**
- Range: 0.1 to 0.3
- Default: 0.1845 (18.45% - photographic standard)
- Pivot point of the curve
- Lower values darken the image
- Higher values brighten the image


#### Sigmoid Presets

- **Soft**: Gentle S-curve for subtle compression
- **Medium**: Balanced S-curve for general use
- **Hard**: Strong S-curve for dramatic look

### Exposure Module

Scene-referred exposure adjustment with highlight preservation.

**Exposure (EV)**
- Photographic stops: +1 EV = 2x brightness
- Works in linear space like in-camera exposure
- Applied before tone mapping

**Black Point**
- Lifts or lowers the black level
- Useful for adjusting shadow density

**Highlight Reconstruction**
- Attempts to recover clipped highlights
- Uses color ratios from unclipped channels
- Enable when highlights are blown out

### White Balance (Chromatic Adaptation)

Professional white balance using Bradford chromatic adaptation.

**Temperature (Kelvin)**
- Range: 2000K to 25000K
- Lower values = cooler (blue)
- Higher values = warmer (orange)
- Common presets:
  - Daylight: 5500K
  - Tungsten: 3200K
  - Fluorescent: 4000K

**Tint**
- Range: -1.0 to 1.0
- Negative: add green
- Positive: add magenta
- Corrects color casts from lighting

## Color Grading

### Color Balance RGB

Professional color grading with independent control over tonal zones.

#### Understanding Zones

Color Balance RGB divides the image into three tonal zones:
- **Shadows**: Dark areas (below middle grey)
- **Midtones**: Middle tones (around middle grey)
- **Highlights**: Bright areas (above middle grey)


Each zone can be adjusted independently using:

**Luminance**
- Brightens or darkens the zone
- Range: -1.0 to 1.0

**Chroma**
- Increases or decreases saturation in the zone
- Range: -1.0 to 1.0

**Hue**
- Rotates colors around the color wheel
- Range: -180° to 180°

#### Mask Controls

**Shadows Weight**
- Controls falloff of shadows mask
- Higher values = sharper transition
- Range: 0.5 to 3.0

**Highlights Weight**
- Controls falloff of highlights mask
- Higher values = sharper transition
- Range: 0.5 to 3.0

**Grey Fulcrum**
- Middle grey point for mask generation
- Default: 0.1845 (18.45%)
- Typically left at default

#### Global Controls

**Contrast**
- Global contrast adjustment
- Applied around contrast fulcrum
- Range: 0.5 to 2.0

**Vibrance**
- Adaptive saturation
- Enhances muted colors more than saturated ones
- Protects skin tones automatically
- Range: -1.0 to 1.0

#### Color Grading Workflow

1. Start with **Global** adjustments for overall look
2. Adjust **Midtones** for the main subject
3. Fine-tune **Shadows** for mood
4. Refine **Highlights** for sky/bright areas
5. Adjust **Masks** if transitions are too harsh/soft


### Saturation and Vibrance

**Saturation**
- Global saturation adjustment
- Applied in perceptually uniform color space
- Range: -1.0 to 1.0 (-1.0 = full desaturation/B&W)

**Vibrance**
- Smart saturation that protects already-saturated colors
- Enhances muted colors more
- Better for portraits (protects skin tones)
- Range: -1.0 to 1.0

**Skin Tone Protection**
- Automatically reduces saturation in skin tone hues
- Enable for portraits
- Adjustable strength: 0.0 to 1.0

## Detail Enhancement

### Guided Filter (Detail Enhancement)

Edge-aware detail enhancement without halos.

**Radius**
- Size of the filter kernel
- Larger values = broader effect
- Range: 1 to 20 pixels

**Epsilon (Edge Threshold)**
- Controls edge preservation
- Lower values = preserve more edges
- Higher values = smoother result
- Range: 0.001 to 1.0

**Strength**
- Amount of detail enhancement
- Positive values = sharpen
- Negative values = smooth/denoise
- Range: -2.0 to 2.0

**Use Cases:**
- Sharpening: strength 0.5-1.5, radius 2-5, epsilon 0.01
- Denoising: strength -0.5 to -1.5, radius 5-10, epsilon 0.1
- Clarity: strength 0.3-0.8, radius 10-15, epsilon 0.05

### Local Laplacian (Local Contrast)

Multi-scale local contrast enhancement.

**Detail**
- Enhances fine details (high frequencies)
- Range: -1.0 to 1.0

**Coarse**
- Enhances structure (low frequencies)
- Range: -1.0 to 1.0


**Strength**
- Overall intensity multiplier
- Range: 0.5 to 2.0

**Levels**
- Number of pyramid levels
- More levels = broader scale range
- Range: 3 to 5

**Use Cases:**
- Landscape: detail 0.4, coarse 0.3, strength 1.3
- Portrait: detail 0.2, coarse 0.1, strength 1.0
- Architecture: detail 0.5, coarse 0.4, strength 1.4

### Gamut Mapping

Ensures colors stay within display gamut.

**Target Gamut**
- sRGB: Standard web/display
- Display P3: Wide gamut displays
- Rec2020: Future HDR displays

**Compression Method**
- **Perceptual**: Preserves hue, compresses chroma smoothly
- **Saturation**: Maximizes saturation within gamut
- **Relative**: Clips out-of-gamut colors

**Note**: Gamut mapping is automatically applied during output. Usually no manual adjustment needed.

## Workflows and Best Practices

### Portrait Workflow

1. **Exposure**: Adjust to proper brightness (+0.3 to +0.5 EV typical)
2. **White Balance**: Correct color temperature for natural skin tones
3. **Tone Mapping**: Use Filmic with soft contrast or Sigmoid
4. **Saturation**: Reduce slightly (-0.1) and add vibrance (+0.2)
5. **Skin Tone Protection**: Enable with strength 0.7-0.9
6. **Detail**: Light smoothing with guided filter (strength -0.3, radius 8)
7. **Local Contrast**: Subtle enhancement (detail 0.2, coarse 0.1)

### Landscape Workflow

1. **Exposure**: Adjust for proper sky/foreground balance
2. **White Balance**: Set for desired mood (warm sunset, cool morning)
3. **Tone Mapping**: Filmic for high DR scenes, Sigmoid for standard
4. **Color Balance RGB**: Enhance sky (highlights), deepen shadows
5. **Saturation**: Increase (+0.2 to +0.4) for vivid look
6. **Local Contrast**: Strong enhancement (detail 0.4, coarse 0.3)
7. **Detail**: Sharpen (strength 0.5-1.0, radius 3-5)


### Black & White Workflow

1. **Exposure**: Adjust for proper tonal distribution
2. **Tone Mapping**: Filmic for classic B&W look
3. **Saturation**: Set to -1.0 for full desaturation
4. **Color Balance RGB**: Use to control zone tonality
   - Shadows: Adjust luminance for shadow depth
   - Highlights: Control highlight brightness
5. **Contrast**: Increase for dramatic B&W (1.2-1.5)
6. **Local Contrast**: Strong enhancement for texture
7. **Detail**: Sharpen for crisp B&W

### HDR/High Dynamic Range Workflow

1. **Exposure**: Set base exposure (may be negative for bright scenes)
2. **Highlight Reconstruction**: Enable to recover blown highlights
3. **Filmic RGB**: Essential for HDR compression
   - White Point: 5.0-6.0 EV for extreme DR
   - Black Point: -9.0 to -10.0 EV
   - Latitude: 60-70% for smooth compression
4. **Color Balance RGB**: Adjust zones independently
5. **Local Contrast**: Moderate to avoid halos

### Film Emulation Workflow

1. **Tone Mapping**: Use Filmic RGB
2. **Filmic Settings**: Adjust for film characteristics
   - Slide film: High contrast, hard shadows/highlights
   - Negative film: Low contrast, soft shadows/highlights
3. **Color Balance RGB**: Add color casts typical of film
   - Warm shadows for vintage look
   - Cool highlights for modern film
4. **Saturation**: Adjust for film stock characteristics
5. **Grain**: Add film grain effect (if available)

## Troubleshooting

### Common Issues

**Problem: Image looks flat/low contrast**
- Solution: Enable tone mapping (Filmic or Sigmoid)
- Check that exposure is properly set
- Increase contrast in Color Balance RGB global settings

**Problem: Blown highlights**
- Solution: Enable highlight reconstruction in Exposure module
- Reduce exposure
- Increase Filmic white point
- Use Sigmoid with positive skew


**Problem: Crushed shadows/lost detail**
- Solution: Increase Filmic black point (less negative)
- Use Sigmoid with negative skew
- Lift shadows in Color Balance RGB
- Reduce contrast

**Problem: Colors look unnatural/oversaturated**
- Solution: Reduce saturation
- Use vibrance instead of saturation
- Enable skin tone protection for portraits
- Check white balance is correct

**Problem: Halos around edges**
- Solution: Reduce local contrast strength
- Decrease guided filter strength
- Increase guided filter epsilon
- Reduce detail enhancement radius

**Problem: Color banding/posterization**
- Solution: Reduce extreme adjustments
- Check that tone mapping is enabled
- Avoid stacking multiple strong adjustments
- Use smoother mask transitions in Color Balance RGB

**Problem: Image too dark after tone mapping**
- Solution: Increase exposure before tone mapping
- Adjust Filmic white/black points
- Increase middle grey in Sigmoid
- Brighten midtones in Color Balance RGB

**Problem: Skin tones look wrong**
- Solution: Adjust white balance first
- Enable skin tone protection
- Reduce saturation, increase vibrance
- Use Color Balance RGB to adjust midtones
- Avoid extreme color shifts

**Problem: Loss of detail in highlights/shadows**
- Solution: Use Filmic with safe contrast mode
- Increase Filmic latitude
- Enable highlight reconstruction
- Reduce contrast
- Use local contrast instead of global contrast

### Performance Issues

**Slow rendering/lag**
- Disable modules you're not using
- Reduce image size for preview
- Close other browser tabs
- Check WebGL is enabled and working
- Update graphics drivers


**High memory usage**
- Work with smaller images
- Disable unused modules
- Reduce local Laplacian levels
- Clear browser cache

### Technical Issues

**WebGL not available**
- Update your browser to the latest version
- Enable hardware acceleration in browser settings
- Update graphics drivers
- Try a different browser

**Image won't load**
- Check file format is supported
- Try a different image
- Check file isn't corrupted
- For RAW files, ensure format is supported (CR2, NEF, ARW, DNG)

**Adjustments not applying**
- Check module is enabled (checkbox)
- Verify sliders are not at default/zero
- Check tone mapping is enabled
- Refresh the page and try again

**Export issues**
- Ensure image is fully loaded
- Wait for all adjustments to render
- Try a different export format
- Check browser has enough memory

## Tips and Tricks

### Keyboard Shortcuts

- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Shift + Z**: Redo
- **Ctrl/Cmd + 0**: Reset all adjustments
- **Space + Drag**: Pan image
- **Ctrl/Cmd + Scroll**: Zoom in/out

### Best Practices

1. **Work in order**: Exposure → White Balance → Tone Mapping → Color → Detail
2. **Use presets as starting points**: Modify built-in presets rather than starting from scratch
3. **Enable only one tone mapper**: Never use Filmic and Sigmoid together
4. **Adjust in small increments**: Subtle adjustments often look more natural
5. **Use vibrance for portraits**: Protects skin tones better than saturation
6. **Save custom presets**: Save your favorite looks for quick application
7. **Check at 100% zoom**: View at full resolution to check sharpness and artifacts
8. **Compare before/after**: Toggle adjustments on/off to see the effect


### Advanced Techniques

**Split Toning with Color Balance RGB**
1. Go to Color Balance RGB
2. Shadows tab: Add cool blue hue
3. Highlights tab: Add warm orange hue
4. Adjust chroma to control intensity

**Selective Sharpening**
1. Use guided filter with low epsilon (0.01)
2. Moderate strength (0.5-0.8)
3. Small radius (2-4 pixels)
4. Edges will be sharpened, smooth areas protected

**Dodge and Burn Effect**
1. Use Color Balance RGB
2. Shadows: Increase luminance to dodge
3. Highlights: Decrease luminance to burn
4. Adjust mask weights for transition control

**Film Grain Simulation**
1. Use local Laplacian with high detail
2. Add slight noise with guided filter
3. Reduce saturation slightly
4. Use Filmic for film-like tonality

**Orton Effect (Glow)**
1. Use guided filter with negative strength
2. Large radius (15-20)
3. Blend with original using reduced strength
4. Adds dreamy glow to images

## Glossary

**Scene-Referred**: Image data representing actual scene luminance before display encoding

**Display-Referred**: Image data prepared for display on a specific output device

**EV (Exposure Value)**: Photographic stops. +1 EV = 2x brightness, -1 EV = 0.5x brightness

**Middle Grey**: Standard reference point at 18.45% reflectance (0.1845 in linear)

**Chroma**: Colorfulness or saturation of a color

**Hue**: The attribute of color that distinguishes red from blue, etc.

**Luminance**: Brightness or lightness of a color

**Gamut**: Range of colors that can be represented in a color space

**DT UCS**: Darktable Uniform Color Space - perceptually uniform color space

**JzAzBz**: HDR-capable perceptual color space

**Bradford Adaptation**: Industry-standard chromatic adaptation method

**Rational Spline**: Mathematical curve used in Filmic for smooth tone mapping

---

**Last Updated**: 2024
**Version**: 2.0 (Darktable-Inspired Edition)

