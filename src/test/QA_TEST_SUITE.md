# Quality Assurance Test Suite

This document describes the comprehensive test suite for the Darktable-inspired image processing improvements.

## Overview

The QA test suite consists of four main categories:

1. **Visual Quality Tests** - Detect visual artifacts and quality issues
2. **Accuracy Tests** - Verify mathematical correctness
3. **Edge Case Tests** - Handle extreme conditions
4. **Cross-Browser Tests** - Ensure compatibility

## Test Files

### 1. Visual Quality Tests (`visualQuality.test.ts`)

Tests for visual quality issues that affect the final image output.

#### Banding and Posterization Detection
- Smooth gradient verification
- Posterization detection
- 16-bit precision validation

#### Halo Detection
- High-contrast edge handling
- Guided filter edge preservation
- Overshoot detection

#### High Dynamic Range Handling
- HDR value preservation (> 1.0)
- Smooth compression to display range
- Highlight detail preservation
- Extreme value handling (no NaN/Infinity)

#### ColorChecker Chart Accuracy
- 24-patch ColorChecker validation
- Neutral patch neutrality
- Color relationship preservation
- Luminance order maintenance

#### Artifact Detection
- Color fringing detection
- Blocking artifacts
- Noise amplification checks

#### Numerical Stability
- Division by zero handling
- Very small value handling
- Very large value handling
- Precision in color space conversions

### 2. Accuracy Tests (`accuracy.test.ts`)

Tests for mathematical accuracy against reference implementations.

#### Color Space Conversion Accuracy
- **sRGB to Linear RGB**: Reference value matching, linear segment handling, monotonicity
- **RGB to XYZ (D65)**: Transformation matrix validation, white point conversion
- **XYZ to Lab (D50)**: White point to Lab conversion, Lab f function
- **Round-trip Accuracy**: sRGB ↔ Linear, RGB ↔ XYZ
- **Bradford Chromatic Adaptation**: Matrix validation, D65 to D50 adaptation

#### Tone Curve Monotonicity
- **Sigmoid Curve**: Monotonic increase, [0,1] mapping
- **Filmic Curve**: Monotonic increase, smooth highlight compression, smooth derivative
- **Exposure Curve**: Linear in log space, color ratio preservation

#### Gamut Mapping Hue Preservation
- Hue preservation during chroma compression
- Smooth chroma compression
- Relative saturation relationship maintenance

#### Numerical Stability
- Very small value handling (underflow prevention)
- Very large value handling (overflow prevention)
- Division by zero with epsilon
- Negative value handling in pow operations
- Precision in iterative calculations
- NaN and Infinity handling

#### Temperature to White Point Accuracy
- Reference white point matching (D50, D65)
- Valid XYZ values for all temperatures
- Correct color temperature trends

### 3. Edge Case Tests (`edgeCases.test.ts`)

Tests for extreme conditions and boundary cases.

#### Pure Black Images (0,0,0)
- Error-free handling
- Exposure adjustment on black
- Tone mapping on black
- Saturation adjustment on black
- Color balance on black
- Division by zero in black pixels
- Logarithm of black

#### Pure White Images (1,1,1)
- Error-free handling
- Exposure adjustment on white
- Tone mapping on white
- Overexposed white compression
- Saturation on white
- Highlight rolloff
- Clipping detection

#### Single-Color Images
- Pure red (1,0,0), green (0,1,0), blue (0,0,1)
- Hue preservation
- Saturation handling
- Desaturation to gray
- Out-of-gamut single colors

#### Extreme Parameter Values
- **Extreme Exposure**: +10 EV, -10 EV, zero
- **Extreme Contrast**: Very high, zero, negative
- **Extreme Saturation**: 10x, zero, negative
- **Extreme Temperature**: 2000K, 25000K, out-of-range clamping
- **Extreme Hue Shifts**: 360°, negative, very large
- **Extreme Filter Radii**: 1 pixel, 100 pixels, zero
- **Extreme Epsilon Values**: Very small, very large, zero

#### Boundary Conditions
- Values at gamut boundary
- Values just outside gamut
- Values at precision limit
- Alternating min/max values
- Rapid transitions

#### Special Values
- NaN rejection
- Infinity rejection
- Negative Infinity rejection
- Negative color values
- Very small negative values

### 4. Cross-Browser Tests (`crossBrowser.test.ts`)

Tests for browser compatibility and consistent behavior.

#### WebGL2 Feature Detection
- WebGL2 support detection
- Required extension checking
- Float texture support
- Maximum texture size
- Maximum texture units
- Maximum vertex attributes
- Maximum varying vectors

#### Fallback Behavior
- Missing WebGL2 fallback
- Lower precision fallback
- Smaller texture fallback
- Missing extension handling
- CPU fallback for critical operations

#### Browser-Specific Quirks
- **Chrome/Edge (Chromium)**: Context loss, float texture precision
- **Firefox**: WebGL implementation, color management
- **Safari**: WebGL2 support, texture size limits, memory constraints

#### Consistent Output Validation
- sRGB conversion consistency
- Color space conversion consistency
- Tone mapping consistency
- Gamma correction consistency
- Floating point precision consistency

#### Performance Consistency
- Operation completion time
- Large array handling
- Typed array consistency

#### Canvas and ImageData Compatibility
- Canvas element creation
- ImageData object creation
- ImageData with provided data
- Canvas 2D context
- Canvas toDataURL

#### Error Handling Consistency
- Shader compilation errors
- Out of memory errors
- Context loss handling
- Invalid image data handling

#### Color Space Support
- Display-P3 support detection
- Wide gamut fallback
- Color space conversion consistency

#### Memory Management
- Memory usage tracking
- Resource release
- Memory pressure handling

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test visualQuality
npm test accuracy
npm test edgeCases
npm test crossBrowser
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Run in Watch Mode
```bash
npm test -- --watch
```

## Test Coverage Goals

- **Visual Quality**: 100% of visual artifacts detected
- **Accuracy**: < 1e-6 error for color conversions
- **Edge Cases**: All extreme values handled gracefully
- **Cross-Browser**: Consistent output across Chrome, Firefox, Safari, Edge

## Continuous Integration

These tests should be run:
- On every pull request
- Before every release
- After any shader or algorithm changes
- When adding new features

## Manual Testing Checklist

In addition to automated tests, perform manual testing:

### Visual Inspection
- [ ] Load test images (ColorChecker, gradients, HDR)
- [ ] Check for banding in smooth gradients
- [ ] Check for halos around high-contrast edges
- [ ] Verify no color fringing
- [ ] Test with extreme parameter values

### Browser Testing
- [ ] Test on Chrome (latest)
- [ ] Test on Firefox (latest)
- [ ] Test on Safari (latest)
- [ ] Test on Edge (latest)
- [ ] Test on mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing
- [ ] Test with 1MP images (< 100ms)
- [ ] Test with 10MP images (< 500ms)
- [ ] Test with 50MP images (< 2s)
- [ ] Monitor memory usage (< 500MB)
- [ ] Check for memory leaks

### Comparison Testing
- [ ] Compare output to Darktable (if possible)
- [ ] Compare to reference implementations
- [ ] Verify color accuracy with ColorChecker
- [ ] Test round-trip conversions

## Known Issues and Limitations

### Browser Limitations
- Safari on iOS has stricter memory limits
- Some older browsers may not support WebGL2
- Float texture support varies by GPU

### Precision Limitations
- JavaScript uses 64-bit floats (some precision loss in conversions)
- WebGL shaders use 32-bit or 16-bit floats
- Very small values may underflow
- Very large values may overflow

### Performance Considerations
- Large images (> 50MP) may be slow
- Complex pipelines may require progressive rendering
- Mobile devices have limited GPU memory

## Future Improvements

- Add visual regression testing with reference images
- Add performance benchmarking
- Add GPU-specific tests
- Add color accuracy measurements (Delta E)
- Add automated comparison to Darktable output
- Add stress testing for memory limits
- Add fuzzing for parameter combinations

## References

- [WebGL2 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [sRGB Specification](https://www.w3.org/Graphics/Color/sRGB)
- [CIE Color Spaces](http://www.brucelindbloom.com/)
- [Darktable Documentation](https://docs.darktable.org/)
- [Color Science Resources](https://www.color.org/)

## Maintenance

This test suite should be updated when:
- New algorithms are added
- Existing algorithms are modified
- New browser versions are released
- New WebGL extensions are used
- Performance requirements change

Last Updated: 2025-11-13
