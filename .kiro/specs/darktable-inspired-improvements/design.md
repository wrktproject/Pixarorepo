# Design Document: Darktable-Inspired Image Processing Improvements

## Overview

This design implements professional-grade image processing algorithms inspired by Darktable's architecture. The implementation focuses on WebGL2-based shader processing for real-time performance, with a modular architecture that allows algorithms to be composed in a processing pipeline.

### Key Design Principles

1. **Scene-Referred Processing**: Work in linear light space for physically accurate operations
2. **Perceptually Uniform Adjustments**: Use proper color spaces (DT UCS, JzAzBz) for user controls
3. **Modular Pipeline**: Each algorithm is an independent shader that can be enabled/disabled
4. **Real-Time Performance**: All operations run on GPU using WebGL2 compute shaders
5. **Color Science Accuracy**: Match industry standards for color transformations

## Architecture

### Processing Pipeline Order

The image processing pipeline follows Darktable's scene-referred workflow:

```
1. Input (sRGB/Display) → Linear RGB
2. White Balance (Chromatic Adaptation)
3. Exposure Compensation
4. Highlight Reconstruction
5. Filmic/Sigmoid Tone Mapping
6. Color Balance RGB (Shadows/Midtones/Highlights)
7. Saturation/Vibrance
8. Local Contrast (Local Laplacian)
9. Detail Enhancement (Guided Filter)
10. Gamut Mapping
11. Output Transform → sRGB/Display
```

### Color Space Strategy

**Working Space**: Linear ProPhoto RGB (wide gamut, scene-referred)
- Allows values > 1.0 for HDR processing
- Wide gamut prevents clipping during color operations
- Linear for physically accurate math

**User Interface Space**: sRGB (display-referred)
- Preview and final output in sRGB
- Familiar to users

**Adjustment Spaces**:
- Tone mapping: Log-encoded RGB
- Color grading: DT UCS 2022 (perceptually uniform)
- Saturation: JzAzBz or DT UCS

## Components and Interfaces

### 1. Filmic Tone Mapping Module

**Purpose**: Compress dynamic range with film-like highlight rolloff

**Algorithm**: Rational spline curve with configurable nodes

**Parameters**:
```typescript
interface FilmicParams {
  whitePoint: number;      // Relative exposure for white (default: 4.0 EV)
  blackPoint: number;      // Relative exposure for black (default: -8.0 EV)
  latitude: number;        // Contrast in midtones (default: 50%)
  shadowsContrast: 'hard' | 'soft' | 'safe';  // Shadow curve type
  highlightsContrast: 'hard' | 'soft' | 'safe'; // Highlight curve type
  balance: number;         // Shadows ↔ highlights balance (-50 to 50)
}
```

**Shader Implementation**:
```glsl
// Filmic spline curve
vec3 filmicCurve(vec3 x, FilmicParams params) {
  // Convert to log space for perceptual uniformity
  vec3 logX = log2(max(x, 1e-8));
  
  // Build rational spline with 5 control points
  // [black, shadows, midtone, highlights, white]
  
  // Apply piecewise rational function
  vec3 result;
  for (int i = 0; i < 3; i++) {
    if (logX[i] < shadowsEnd) {
      result[i] = shadowsSpline(logX[i]);
    } else if (logX[i] < highlightsStart) {
      result[i] = midtonesLinear(logX[i]);
    } else {
      result[i] = highlightsSpline(logX[i]);
    }
  }
  
  return pow(vec3(2.0), result);
}
```

**Key Features**:
- Smooth highlight rolloff (no harsh clipping)
- Configurable contrast in shadows and highlights
- Preserves color ratios (no hue shifts)
- Works in log space for perceptual control

### 2. Color Balance RGB Module

**Purpose**: Independent color grading for shadows, midtones, and highlights

**Algorithm**: Luminance masks + perceptual color shifts in DT UCS

**Parameters**:
```typescript
interface ColorBalanceParams {
  // Per-zone adjustments (shadows, midtones, highlights, global)
  shadows: { luminance: number; chroma: number; hue: number };
  midtones: { luminance: number; chroma: number; hue: number };
  highlights: { luminance: number; chroma: number; hue: number };
  global: { luminance: number; chroma: number; hue: number };
  
  // Mask controls
  shadowsWeight: number;      // Falloff for shadows mask (0-3)
  highlightsWeight: number;   // Falloff for highlights mask (0-3)
  maskGreyFulcrum: number;    // Middle grey for mask (default: 18.45%)
  
  // Additional controls
  contrast: number;           // Global contrast
  greyFulcrum: number;        // Pivot point for contrast
  vibrance: number;           // Adaptive saturation
}
```

**Shader Implementation**:
```glsl
// Generate luminance masks
vec3 generateMasks(float Y, ColorBalanceParams params) {
  float grey = params.maskGreyFulcrum;
  
  // Shadows mask: 1.0 at black, 0.0 at grey
  float shadows = pow(clamp(1.0 - Y / grey, 0.0, 1.0), 
                      params.shadowsWeight);
  
  // Highlights mask: 0.0 at grey, 1.0 at white
  float highlights = pow(clamp((Y - grey) / (1.0 - grey), 0.0, 1.0), 
                         params.highlightsWeight);
  
  // Midtones mask: peak at grey
  float midtones = 1.0 - shadows - highlights;
  
  return vec3(shadows, midtones, highlights);
}

// Apply color balance
vec3 colorBalance(vec3 rgb, ColorBalanceParams params) {
  // Convert to DT UCS for perceptual uniformity
  vec3 JCH = rgbToDTUCS(rgb);
  
  // Generate masks based on luminance
  vec3 masks = generateMasks(JCH.x, params);
  
  // Apply per-zone adjustments
  JCH += masks.x * params.shadows;
  JCH += masks.y * params.midtones;
  JCH += masks.z * params.highlights;
  JCH += params.global;
  
  // Convert back to RGB
  return dtucsToRGB(JCH);
}
```

**Key Features**:
- Perceptually uniform color adjustments
- Smooth mask transitions
- Independent control of luminance, chroma, hue
- No color banding or posterization

### 3. Sigmoid Tone Curve Module

**Purpose**: Simpler alternative to filmic with excellent color preservation

**Algorithm**: Generalized logistic function (sigmoid)

**Parameters**:
```typescript
interface SigmoidParams {
  contrast: number;    // Steepness of S-curve (0.5 - 2.0)
  skew: number;        // Shift curve toward shadows or highlights (-1 to 1)
  middleGrey: number;  // Target middle grey (default: 18.45%)
}
```

**Shader Implementation**:
```glsl
// Sigmoid tone curve
float sigmoidCurve(float x, float contrast, float skew) {
  // Generalized logistic function
  float x0 = 0.5 + skew * 0.3;  // Inflection point
  float k = contrast * 10.0;     // Steepness
  
  return 1.0 / (1.0 + exp(-k * (x - x0)));
}

vec3 applySigmoid(vec3 rgb, SigmoidParams params) {
  // Apply per-channel to preserve color ratios
  vec3 result;
  for (int i = 0; i < 3; i++) {
    result[i] = sigmoidCurve(rgb[i], params.contrast, params.skew);
  }
  return result;
}
```

**Key Features**:
- Simpler than filmic (fewer parameters)
- Excellent color preservation
- Smooth S-curve compression
- Fast computation

### 4. Guided Filter Module

**Purpose**: Edge-aware detail enhancement and noise reduction

**Algorithm**: Fast guided filter (O(N) complexity)

**Parameters**:
```typescript
interface GuidedFilterParams {
  radius: number;      // Filter radius in pixels (1-20)
  epsilon: number;     // Edge threshold (0.001 - 1.0)
  strength: number;    // Detail enhancement strength (0-2)
}
```

**Shader Implementation**:
```glsl
// Guided filter for detail enhancement
vec3 guidedFilter(sampler2D image, vec2 uv, GuidedFilterParams params) {
  // Use luminance as guide
  float guide = rgb2luminance(texture(image, uv).rgb);
  
  // Compute local statistics in radius
  float meanI = boxFilter(guide, params.radius);
  float meanP = boxFilter(texture(image, uv).rgb, params.radius);
  float corrI = boxFilter(guide * guide, params.radius);
  float corrIP = boxFilter(guide * texture(image, uv).rgb, params.radius);
  
  // Compute linear coefficients
  float varI = corrI - meanI * meanI;
  vec3 covIP = corrIP - meanI * meanP;
  
  vec3 a = covIP / (varI + params.epsilon);
  vec3 b = meanP - a * meanI;
  
  // Apply filter
  vec3 meanA = boxFilter(a, params.radius);
  vec3 meanB = boxFilter(b, params.radius);
  
  return meanA * guide + meanB;
}
```

**Key Features**:
- Preserves edges while smoothing
- No halos around high-contrast edges
- Efficient O(N) implementation
- Works for both sharpening and denoising

### 5. Color Space Conversion Library

**Purpose**: Accurate transformations between color spaces

**Supported Spaces**:
- sRGB (display)
- Linear RGB
- ProPhoto RGB (working space)
- CIE XYZ (D50 and D65)
- CIE Lab (D50)
- DT UCS 2022 (perceptually uniform)
- JzAzBz (HDR-capable perceptual space)

**Implementation**:
```glsl
// sRGB to Linear
vec3 srgbToLinear(vec3 srgb) {
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

// Linear to sRGB
vec3 linearToSrgb(vec3 linear) {
  vec3 srgb;
  for (int i = 0; i < 3; i++) {
    if (linear[i] <= 0.0031308) {
      srgb[i] = linear[i] * 12.92;
    } else {
      srgb[i] = 1.055 * pow(linear[i], 1.0/2.4) - 0.055;
    }
  }
  return srgb;
}

// RGB to XYZ (D50)
vec3 rgbToXYZ_D50(vec3 rgb) {
  mat3 matrix = mat3(
    0.4360747, 0.3850649, 0.1430804,
    0.2225045, 0.7168786, 0.0606169,
    0.0139322, 0.0971045, 0.7141733
  );
  return matrix * rgb;
}

// XYZ to Lab (D50)
vec3 xyzToLab_D50(vec3 xyz) {
  vec3 d50 = vec3(0.9642, 1.0, 0.8249);
  vec3 f = xyz / d50;
  
  // Apply Lab f function
  for (int i = 0; i < 3; i++) {
    if (f[i] > 0.008856) {
      f[i] = pow(f[i], 1.0/3.0);
    } else {
      f[i] = 7.787 * f[i] + 16.0/116.0;
    }
  }
  
  float L = 116.0 * f.y - 16.0;
  float a = 500.0 * (f.x - f.y);
  float b = 200.0 * (f.y - f.z);
  
  return vec3(L, a, b);
}

// DT UCS 2022 (simplified)
vec3 rgbToDTUCS(vec3 rgb) {
  // Convert to XYZ
  vec3 xyz = rgbToXYZ_D50(rgb);
  
  // Apply DT UCS transform
  // (Simplified version - full implementation uses more complex math)
  float J = pow(xyz.y, 0.6); // Lightness
  float C = length(xyz.xz);   // Chroma
  float H = atan(xyz.z, xyz.x); // Hue
  
  return vec3(J, C, H);
}
```

### 6. Chromatic Adaptation Module

**Purpose**: Proper white balance with Bradford transform

**Algorithm**: Bradford chromatic adaptation transform

**Parameters**:
```typescript
interface WhiteBalanceParams {
  temperature: number;  // Color temperature in Kelvin (2000-25000)
  tint: number;         // Green-magenta shift (-1 to 1)
}
```

**Shader Implementation**:
```glsl
// Bradford chromatic adaptation
vec3 bradfordAdaptation(vec3 rgb, vec3 sourceWhite, vec3 targetWhite) {
  // Bradford matrix
  mat3 bradford = mat3(
     0.8951,  0.2664, -0.1614,
    -0.7502,  1.7135,  0.0367,
     0.0389, -0.0685,  1.0296
  );
  
  mat3 bradfordInv = inverse(bradford);
  
  // Convert whites to cone response
  vec3 sourceRho = bradford * sourceWhite;
  vec3 targetRho = bradford * targetWhite;
  
  // Build adaptation matrix
  mat3 adapt = mat3(
    targetRho.x / sourceRho.x, 0.0, 0.0,
    0.0, targetRho.y / sourceRho.y, 0.0,
    0.0, 0.0, targetRho.z / sourceRho.z
  );
  
  // Apply adaptation
  return bradfordInv * adapt * bradford * rgb;
}

// Temperature to XYZ white point
vec3 temperatureToWhite(float kelvin) {
  // Planckian locus approximation
  float x, y;
  
  if (kelvin < 4000.0) {
    x = -0.2661239e9 / pow(kelvin, 3.0) 
        - 0.2343589e6 / pow(kelvin, 2.0) 
        + 0.8776956e3 / kelvin + 0.179910;
  } else {
    x = -3.0258469e9 / pow(kelvin, 3.0) 
        + 2.1070379e6 / pow(kelvin, 2.0) 
        + 0.2226347e3 / kelvin + 0.240390;
  }
  
  y = -1.1063814 * pow(x, 3.0) 
      - 1.34811020 * pow(x, 2.0) 
      + 2.18555832 * x - 0.20219683;
  
  // Convert xy to XYZ
  float Y = 1.0;
  float X = (Y / y) * x;
  float Z = (Y / y) * (1.0 - x - y);
  
  return vec3(X, Y, Z);
}
```

### 7. Perceptual Saturation Module

**Purpose**: Vibrance and saturation with skin tone protection

**Algorithm**: Adaptive saturation based on existing chroma

**Parameters**:
```typescript
interface SaturationParams {
  saturation: number;  // Global saturation (-1 to 1)
  vibrance: number;    // Adaptive saturation (-1 to 1)
}
```

**Shader Implementation**:
```glsl
// Perceptual vibrance
vec3 applyVibrance(vec3 rgb, float vibrance) {
  // Convert to JzAzBz for perceptual uniformity
  vec3 jab = rgbToJzAzBz(rgb);
  
  float J = jab.x;
  float C = length(jab.yz);
  float H = atan(jab.z, jab.y);
  
  // Adaptive saturation: enhance muted colors more
  float satWeight = 1.0 - pow(C, 0.5);
  float newC = C * (1.0 + vibrance * satWeight);
  
  // Protect skin tones (hue around 30-60 degrees)
  float skinProtection = smoothstep(20.0, 40.0, degrees(H)) 
                       * (1.0 - smoothstep(40.0, 70.0, degrees(H)));
  newC = mix(newC, C, skinProtection * 0.5);
  
  // Reconstruct
  jab.y = newC * cos(H);
  jab.z = newC * sin(H);
  
  return jzAzBzToRGB(jab);
}
```

### 8. Exposure Module with Highlight Preservation

**Purpose**: Scene-referred exposure with highlight recovery

**Algorithm**: Linear exposure + highlight reconstruction

**Parameters**:
```typescript
interface ExposureParams {
  exposure: number;              // EV adjustment (-10 to 10)
  blackPoint: number;            // Black level (0 to 1)
  highlightReconstruction: boolean;
  reconstructionThreshold: number;
}
```

**Shader Implementation**:
```glsl
// Exposure with highlight preservation
vec3 applyExposure(vec3 rgb, ExposureParams params) {
  // Linear exposure in scene-referred space
  float scale = pow(2.0, params.exposure);
  vec3 exposed = rgb * scale;
  
  // Black point
  exposed = max(exposed - params.blackPoint, 0.0) 
            / (1.0 - params.blackPoint);
  
  // Highlight reconstruction
  if (params.highlightReconstruction) {
    float maxChannel = max(max(exposed.r, exposed.g), exposed.b);
    
    if (maxChannel > params.reconstructionThreshold) {
      // Reconstruct clipped channels using color ratios
      vec3 ratios = exposed / maxChannel;
      float avgRatio = (ratios.r + ratios.g + ratios.b) / 3.0;
      
      // Blend toward average ratio for clipped regions
      float blend = smoothstep(params.reconstructionThreshold, 
                               params.reconstructionThreshold + 1.0, 
                               maxChannel);
      exposed = mix(exposed, vec3(avgRatio * maxChannel), blend);
    }
  }
  
  return exposed;
}
```

### 9. Local Laplacian Module

**Purpose**: Multi-scale local contrast enhancement

**Algorithm**: Local Laplacian pyramid with edge-aware processing

**Parameters**:
```typescript
interface LocalLaplacianParams {
  detail: number;      // Detail enhancement (-1 to 1)
  coarse: number;      // Coarse structure (-1 to 1)
  fine: number;        // Fine detail (-1 to 1)
}
```

**Implementation Note**: 
Local Laplacian is computationally expensive. For real-time performance, we'll implement a simplified version using:
1. Gaussian pyramid (3-4 levels)
2. Laplacian pyramid from Gaussian
3. Per-level gain control
4. Pyramid reconstruction

### 10. Gamut Mapping Module

**Purpose**: Compress out-of-gamut colors for display

**Algorithm**: Perceptual gamut compression with hue preservation

**Parameters**:
```typescript
interface GamutMappingParams {
  targetGamut: 'sRGB' | 'Display P3' | 'Rec2020';
  compressionMethod: 'perceptual' | 'saturation' | 'relative';
}
```

**Shader Implementation**:
```glsl
// Gamut mapping with hue preservation
vec3 gamutMap(vec3 rgb, float maxChroma) {
  // Convert to LCH
  vec3 lab = rgbToLab(rgb);
  float L = lab.x;
  float C = length(lab.yz);
  float H = atan(lab.z, lab.y);
  
  // Compress chroma if out of gamut
  if (C > maxChroma) {
    // Soft compression curve
    float ratio = maxChroma / C;
    float compressed = maxChroma * (1.0 - exp(-C / maxChroma));
    C = compressed;
  }
  
  // Reconstruct
  lab.y = C * cos(H);
  lab.z = C * sin(H);
  
  return labToRGB(lab);
}
```

## Data Models

### Processing Pipeline State

```typescript
interface PipelineState {
  // Input
  sourceImage: WebGLTexture;
  
  // Working buffers
  linearRGB: WebGLTexture;
  workingSpace: WebGLTexture;
  
  // Output
  displayRGB: WebGLTexture;
  
  // Module states
  modules: {
    whiteBalance: { enabled: boolean; params: WhiteBalanceParams };
    exposure: { enabled: boolean; params: ExposureParams };
    filmic: { enabled: boolean; params: FilmicParams };
    sigmoid: { enabled: boolean; params: SigmoidParams };
    colorBalance: { enabled: boolean; params: ColorBalanceParams };
    saturation: { enabled: boolean; params: SaturationParams };
    localContrast: { enabled: boolean; params: LocalLaplacianParams };
    detail: { enabled: boolean; params: GuidedFilterParams };
    gamutMapping: { enabled: boolean; params: GamutMappingParams };
  };
}
```

### Shader Program Registry

```typescript
interface ShaderRegistry {
  programs: Map<string, WebGLProgram>;
  uniforms: Map<string, Map<string, WebGLUniformLocation>>;
  
  compile(name: string, vertexSrc: string, fragmentSrc: string): void;
  use(name: string): void;
  setUniforms(name: string, uniforms: Record<string, any>): void;
}
```

## Error Handling

### Shader Compilation Errors
- Validate shader source before compilation
- Provide detailed error messages with line numbers
- Fall back to simpler algorithms if advanced features unavailable

### WebGL Context Loss
- Detect context loss events
- Rebuild all textures and shaders
- Restore pipeline state

### Out of Memory
- Monitor texture memory usage
- Use lower precision (float16) where possible
- Implement texture pooling and reuse

### Numerical Stability
- Clamp intermediate values to prevent NaN/Inf
- Use epsilon values for division
- Handle edge cases (black pixels, white pixels)

## Testing Strategy

### Unit Tests
- Color space conversion accuracy (compare to reference implementations)
- Tone curve monotonicity
- Gamut mapping hue preservation
- Numerical stability with edge cases

### Integration Tests
- Full pipeline processing
- Module enable/disable combinations
- Parameter range validation
- Performance benchmarks

### Visual Tests
- Compare output to Darktable reference images
- Test with standard test images (ColorChecker, gradients)
- Verify no banding or posterization
- Check for halos and artifacts

### Performance Tests
- Measure frame time for each module
- Test with various image sizes (1MP to 50MP)
- Profile GPU memory usage
- Benchmark against current implementation

## Performance Considerations

### Optimization Strategies

1. **Shader Optimization**
   - Use texture lookups instead of computation where possible
   - Minimize branching in shaders
   - Use built-in functions (mix, smoothstep, etc.)
   - Pack multiple operations into single pass

2. **Texture Management**
   - Reuse textures between passes
   - Use appropriate precision (float16 vs float32)
   - Implement texture pooling
   - Lazy allocation of working buffers

3. **Pipeline Optimization**
   - Combine compatible operations into single shader
   - Skip disabled modules
   - Cache unchanged results
   - Use progressive rendering for large images

4. **Memory Management**
   - Limit maximum texture size
   - Use mipmaps for multi-scale operations
   - Release unused resources promptly
   - Monitor and report memory usage

### Target Performance

- **Real-time preview**: 30 FPS at 1920x1080
- **Full resolution**: < 2 seconds for 24MP image
- **Memory usage**: < 500MB for typical workflow
- **Startup time**: < 100ms for shader compilation

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Color space conversion library
- Shader registry and pipeline manager
- Basic tone mapping (sigmoid)
- Testing framework

### Phase 2: Advanced Tone Mapping (Week 3-4)
- Filmic RGB implementation
- Exposure with highlight preservation
- Chromatic adaptation (white balance)

### Phase 3: Color Grading (Week 5-6)
- Color Balance RGB
- Perceptual saturation/vibrance
- Gamut mapping

### Phase 4: Detail Enhancement (Week 7-8)
- Guided filter
- Local Laplacian (simplified)
- Integration and optimization

### Phase 5: Polish and Testing (Week 9-10)
- Performance optimization
- Visual quality testing
- Documentation
- User interface integration
