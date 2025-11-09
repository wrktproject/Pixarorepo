# Developer Guide: Advanced Shader Pipeline

## Overview

This comprehensive guide covers everything developers need to know to work with the advanced shader pipeline, from basic usage to advanced customization.

**Target Audience**: Frontend developers, graphics programmers  
**Prerequisites**: TypeScript, WebGL basics, image processing concepts  
**Version**: 2.0.0

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Concepts](#core-concepts)
3. [Architecture Deep Dive](#architecture-deep-dive)
4. [Working with Shaders](#working-with-shaders)
5. [Performance Optimization](#performance-optimization)
6. [Extending the Pipeline](#extending-the-pipeline)
7. [Testing and Debugging](#testing-and-debugging)
8. [Best Practices](#best-practices)
9. [API Reference](#api-reference)

---

## Quick Start

### Basic Setup

```typescript
import { ShaderPipeline } from './engine/shaderPipeline';
import { WebGLContextManager } from './engine/webglContext';
import type { AdjustmentState } from './types/adjustments';

// 1. Get canvas and create context manager
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const contextManager = new WebGLContextManager(canvas);

// 2. Create pipeline with configuration
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: 2048,
  enableToneMapping: false,
  enablePerformanceMonitoring: true,
  qualityMode: 'preview',
});

// 3. Load an image
const img = new Image();
img.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  
  pipeline.loadImage(imageData);
};
img.src = 'photo.jpg';

// 4. Apply adjustments
const adjustments: AdjustmentState = {
  exposure: 0.5,
  contrast: 1.2,
  highlights: -0.3,
  shadows: 0.2,
  whites: 0,
  blacks: 0,
  temperature: 10,
  tint: 0,
  vibrance: 0.2,
  saturation: 0.1,
  hsl: {
    red: { hue: 0, saturation: 0, luminance: 0 },
    orange: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    aqua: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    purple: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 },
  },
  clarity: 0.3,
  sharpening: 0.5,
  noiseReductionLuma: 0,
  noiseReductionColor: 0,
  vignette: { amount: 0, midpoint: 0.5, feather: 0.5 },
  grain: { amount: 0, size: 1.0 },
  crop: null,
  straighten: 0,
};

pipeline.render(adjustments);

// 5. Cleanup when done
pipeline.dispose();
```

### React Integration

```typescript
import { useEffect, useRef, useState } from 'react';
import { ShaderPipeline } from './engine/shaderPipeline';
import { WebGLContextManager } from './engine/webglContext';

function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<ShaderPipeline | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentState>(defaultAdjustments);

  // Initialize pipeline
  useEffect(() => {
    if (!canvasRef.current) return;

    const contextManager = new WebGLContextManager(canvasRef.current);
    pipelineRef.current = new ShaderPipeline(contextManager, {
      maxPreviewSize: 2048,
      enablePerformanceMonitoring: true,
    });

    return () => {
      pipelineRef.current?.dispose();
    };
  }, []);

  // Render when adjustments change
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.render(adjustments);
    }
  }, [adjustments]);

  return (
    <div>
      <canvas ref={canvasRef} />
      <Controls adjustments={adjustments} onChange={setAdjustments} />
    </div>
  );
}
```

---

## Core Concepts

### Color Space Management

The pipeline uses **linear RGB** for all processing and converts to/from sRGB for display.

**Why Linear Space?**
- Mathematical operations are physically accurate
- Exposure adjustments work correctly (+1 stop = double brightness)
- Color blending produces correct results
- Tone mapping works properly

**Conversion Flow:**
```
Input (sRGB 8-bit) → Linear RGB (float) → Processing → Linear RGB → sRGB (8-bit) → Display
```

**Example:**
```glsl
// In base shader: Convert input to linear
vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);

// Process in linear space
color *= pow(2.0, u_exposure);  // Photographic exposure

// In output shader: Convert back to sRGB
color = linearToSRGB(color);
```

### Multi-Pass Rendering

The pipeline uses multiple shader passes with intermediate framebuffers:

```
Pass 0: Base (sRGB → Linear)
  ↓ [Framebuffer 0]
Pass 1: Geometric (Crop/Rotate)
  ↓ [Framebuffer 1]
Pass 2: Tonal (Exposure, Contrast, etc.)
  ↓ [Framebuffer 2]
Pass 3: Color (Temperature, Saturation)
  ↓ [Framebuffer 3]
Pass 4: HSL (Per-channel adjustments)
  ↓ [Framebuffer 4]
Pass 5: Clarity (Multi-pass Gaussian blur)
  ↓ [Framebuffer 5]
Pass 6: Detail (Sharpening, Noise Reduction)
  ↓ [Framebuffer 6]
Pass 7: Effects (Vignette, Grain)
  ↓ [Framebuffer 7]
Pass 8: Output (Tone Mapping, Linear → sRGB)
  ↓ Canvas
```

**Benefits:**
- Each pass focuses on one task
- Intermediate results can be reused
- Easier to debug and optimize
- Supports complex effects (blur, clarity)

### Dirty Flag Optimization

The pipeline tracks which passes need to be re-executed:

```typescript
// When exposure changes, only tonal pass and subsequent passes are dirty
updateDirtyFlags(adjustments) {
  if (prev.exposure !== adjustments.exposure) {
    this.markPassDirty('tonal');  // Marks tonal and all after as dirty
  }
}

// During render, skip clean passes
for (const pass of this.passes) {
  if (!pass.isDirty) {
    continue;  // Skip this pass, use cached result
  }
  // Execute pass...
  pass.isDirty = false;
}
```

**Performance Impact:**
- Reduces redundant shader executions
- Improves responsiveness when adjusting single sliders
- Can reduce frame time by 50-70% for single adjustments

### Render Scheduling

The `RenderScheduler` optimizes rendering with:

1. **Batching**: Multiple slider changes within 16ms are batched into one render
2. **requestAnimationFrame**: Syncs with display refresh
3. **Frame Skipping**: Skips frames if rendering is too slow
4. **Performance Monitoring**: Tracks FPS and frame times

```typescript
// User moves exposure slider rapidly
setExposure(0.1);  // Scheduled
setExposure(0.2);  // Batched with previous
setExposure(0.3);  // Batched with previous
// Only one render happens after 16ms delay
```

### Quality Modes

**Preview Mode** (default):
- Downscales images to max 2048px
- Uses RGBA16F textures
- Optimized for real-time performance
- Target: 60 FPS

**Export Mode**:
- Full resolution (no downscaling)
- Uses RGBA16F textures
- Applies dithering for 8-bit output
- Target: High quality, not real-time

```typescript
// Switch to export mode
pipeline.setQualityMode('export');
pipeline.loadImage(fullResImageData);  // Reload at full resolution
pipeline.render(adjustments);

// Switch back to preview
pipeline.setQualityMode('preview');
pipeline.loadImage(imageData);  // Reload at preview resolution
```

---

## Architecture Deep Dive

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      ShaderPipeline                          │
│  - Orchestrates rendering                                    │
│  - Manages shader passes                                     │
│  - Handles dirty flags                                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────────────────────────────────────────┐
             │                                                 │
    ┌────────▼────────┐  ┌──────────────┐  ┌────────────────┐│
    │ RenderScheduler │  │ ShaderCompiler│  │PerformanceProfiler│
    │ - Batching      │  │ - Compilation │  │ - Metrics      ││
    │ - Frame skip    │  │ - Caching     │  │ - Profiling    ││
    └─────────────────┘  └───────────────┘  └────────────────┘│
             │                                                 │
    ┌────────▼────────┐  ┌──────────────┐  ┌────────────────┐│
    │ TextureManager  │  │FramebufferMgr│  │ ClarityPipeline││
    │ - Upload        │  │ - Pooling     │  │ - Multi-pass   ││
    │ - Reuse         │  │ - RGBA16F     │  │ - Gaussian blur││
    └─────────────────┘  └───────────────┘  └────────────────┘│
             │                                                 │
    ┌────────▼────────────────────────────────────────────────┘
    │                  Shader Modules                          │
    │  - base.ts, tonal.ts, color.ts, detail.ts, etc.        │
    │  - Modular GLSL libraries (colorSpaceUtils, etc.)      │
    └──────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input (Slider Change)
  ↓
AdjustmentState Updated
  ↓
pipeline.render(adjustments)
  ↓
RenderScheduler.scheduleRender()
  ↓ (batching delay: 16ms)
RenderScheduler.requestRender()
  ↓ (requestAnimationFrame)
ShaderPipeline.executeRender()
  ↓
Update Dirty Flags
  ↓
For Each Pass:
  ├─ Skip if not dirty
  ├─ Bind framebuffer
  ├─ Use shader program
  ├─ Set uniforms
  ├─ Render quad
  └─ Mark as clean
  ↓
Update Performance Metrics
  ↓
Display on Canvas
```

### Memory Management

**Texture Pooling:**
```typescript
// TextureManager reuses textures when dimensions match
const texture = textureManager.createOrUpdateTextureFromImageData(
  existingTexture,  // Reuse if dimensions match
  imageData
);
```

**Framebuffer Pooling:**
```typescript
// FramebufferManager pools framebuffers for reuse
const { framebuffer, texture } = framebufferManager.getFramebuffer({
  width: 1024,
  height: 768,
  format: 'rgba16f',
});
// Returns pooled framebuffer if available, creates new if not
```

**Automatic Cleanup:**
```typescript
// Pipeline automatically cleans up resources
pipeline.dispose();
// - Deletes all textures
// - Deletes all framebuffers
// - Deletes all shader programs
// - Stops render scheduler
// - Cleans up profiler
```

---

## Working with Shaders

### Shader Composition System

The pipeline uses a modular shader system with `#include` directives:

```glsl
#version 300 es
precision highp float;

// Include utility libraries
#include "colorSpaceUtils"
#include "mathUtils"

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_exposure;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Use functions from included libraries
    color = sRGBToLinear(color);
    color *= pow(2.0, u_exposure);
    color = linearToSRGB(color);
    
    fragColor = vec4(color, 1.0);
}
```

### Creating a New Shader Pass

**Step 1: Create shader file**

```typescript
// src/engine/shaders/myEffect.ts
export const myEffectVertexShader = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
    v_texCoord = a_texCoord;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const myEffectFragmentShader = `#version 300 es
precision highp float;

#include "colorSpaceUtils"

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform float u_strength;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_texture, v_texCoord).rgb;
    
    // Apply your effect
    float lum = getLuminance(color);
    color = mix(color, vec3(lum), u_strength);
    
    fragColor = vec4(color, 1.0);
}
`;

export function applyMyEffectUniforms(
  gl: WebGL2RenderingContext,
  uniforms: Map<string, WebGLUniformLocation>,
  strength: number
): void {
  const strengthLoc = uniforms.get('u_strength');
  if (strengthLoc) {
    gl.uniform1f(strengthLoc, strength);
  }
}
```

**Step 2: Add to pipeline**

```typescript
// In ShaderPipeline.compileShaders()
this.myEffectProgram = this.shaderCompiler.createProgram(
  myEffectVertexShader,
  myEffectFragmentShader,
  ['u_texture', 'u_strength'],
  ['a_position', 'a_texCoord']
);

// Add to passes array
this.passes.push({
  name: 'myEffect',
  program: this.myEffectProgram,
  isDirty: true,
});
```

**Step 3: Apply uniforms**

```typescript
// In ShaderPipeline.applyPassUniforms()
case 'myEffect':
  applyMyEffectUniforms(this.gl, pass.program.uniforms, adjustments.myEffectStrength);
  break;
```

**Step 4: Update dirty flags**

```typescript
// In ShaderPipeline.updateDirtyFlags()
if (prev.myEffectStrength !== adjustments.myEffectStrength) {
  this.markPassDirty('myEffect');
}
```

### Creating a Shader Library Module

**Step 1: Create GLSL file**

```glsl
// src/engine/shaders/lib/myUtils.glsl
/**
 * My Utility Functions
 * 
 * Custom utilities for my effects.
 * 
 * @module myUtils
 * @version 1.0.0
 * @requires GLSL ES 3.00
 */

/**
 * Apply custom curve
 * 
 * @param x - Input value [0-1]
 * @param strength - Curve strength [0-1]
 * @return Curved value [0-1]
 */
float myCurve(float x, float strength) {
    return pow(x, 1.0 + strength);
}
```

**Step 2: Register module**

```typescript
// In ShaderComposer.registerBuiltInModules()
import myUtilsGLSL from './shaders/lib/myUtils.glsl?raw';

this.registerModule({
  name: 'myUtils',
  source: myUtilsGLSL,
  dependencies: [],
  version: '1.0.0',
  description: 'Custom utility functions',
});
```

**Step 3: Use in shaders**

```glsl
#include "myUtils"

void main() {
    float value = myCurve(input, 0.5);
}
```

---

## Performance Optimization

### Profiling

```typescript
// Enable profiling
const pipeline = new ShaderPipeline(contextManager, {
  enablePerformanceMonitoring: true,
});

// Get performance profile
const profile = pipeline.getPerformanceProfile();

console.log('Render Performance:');
console.log(`  FPS: ${profile.render.currentFPS.toFixed(1)}`);
console.log(`  Frame Time: ${profile.render.averageFrameTime.toFixed(2)}ms`);
console.log(`  Dropped Frames: ${profile.render.droppedFrames}`);

console.log('\nShader Passes:');
profile.shaderPasses.forEach((pass, name) => {
  console.log(`  ${name}: ${pass.averageExecutionTime.toFixed(2)}ms`);
});

console.log('\nTexture Uploads:');
console.log(`  Count: ${profile.textureUploads.count}`);
console.log(`  Average Time: ${profile.textureUploads.averageTime.toFixed(2)}ms`);
console.log(`  Reuse Ratio: ${(profile.textureUploads.reuseRatio * 100).toFixed(1)}%`);

console.log('\nFramebuffer Pool:');
console.log(`  Hit Ratio: ${(profile.framebufferPool.hitRatio * 100).toFixed(1)}%`);
console.log(`  Active: ${profile.framebufferPool.activeFramebuffers}`);
```

### Optimization Strategies

**1. Reduce Preview Size**
```typescript
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: 1024,  // Reduce from 2048
});
```

**2. Disable Expensive Effects**
```typescript
const adjustments = {
  ...baseAdjustments,
  clarity: 0,              // Disable clarity (multi-pass)
  noiseReductionLuma: 0,   // Disable noise reduction
  noiseReductionColor: 0,
};
```

**3. Use Fast Color Space Conversion**
```glsl
// In shader, use fast approximation for preview
#ifdef PREVIEW_MODE
  color = sRGBToLinearFast(color);  // 2-3x faster
#else
  color = sRGBToLinear(color);      // Accurate
#endif
```

**4. Optimize Texture Uploads**
```typescript
// Reuse texture when possible
const texture = textureManager.createOrUpdateTextureFromImageData(
  existingTexture,  // Reuse if dimensions match
  imageData
);
```

**5. Batch Adjustments**
```typescript
// Bad: Multiple renders
setExposure(0.5);
pipeline.render(adjustments);
setContrast(1.2);
pipeline.render(adjustments);

// Good: Single render
setExposure(0.5);
setContrast(1.2);
pipeline.render(adjustments);  // Batched automatically
```

### Performance Targets

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| FPS | 60 | 30-60 | <30 |
| Frame Time | <16ms | 16-33ms | >33ms |
| Single Pass | <5ms | 5-10ms | >10ms |
| Texture Upload | <10ms | 10-20ms | >20ms |

---

## Extending the Pipeline

### Adding Custom Adjustments

**Step 1: Update AdjustmentState type**

```typescript
// src/types/adjustments.ts
export interface AdjustmentState {
  // ... existing adjustments
  myCustomEffect: number;  // Add your adjustment
}
```

**Step 2: Create shader**

```typescript
// src/engine/shaders/myCustomEffect.ts
export const myCustomEffectFragmentShader = `...`;
export function applyMyCustomEffectUniforms(...) { ... }
```

**Step 3: Integrate into pipeline**

```typescript
// In ShaderPipeline
private myCustomEffectProgram: ShaderProgram | null = null;

// In compileShaders()
this.myCustomEffectProgram = this.shaderCompiler.createProgram(...);

// In passes array
this.passes.push({ name: 'myCustomEffect', program: this.myCustomEffectProgram, isDirty: true });

// In applyPassUniforms()
case 'myCustomEffect':
  applyMyCustomEffectUniforms(this.gl, pass.program.uniforms, adjustments.myCustomEffect);
  break;

// In updateDirtyFlags()
if (prev.myCustomEffect !== adjustments.myCustomEffect) {
  this.markPassDirty('myCustomEffect');
}
```

**Step 4: Add UI control**

```typescript
// In your UI component
<Slider
  label="My Custom Effect"
  value={adjustments.myCustomEffect}
  onChange={(value) => setAdjustments({ ...adjustments, myCustomEffect: value })}
  min={0}
  max={1}
  step={0.01}
/>
```

### Creating Multi-Pass Effects

For effects that require multiple passes (like blur, clarity):

**Step 1: Create pipeline class**

```typescript
// src/engine/myMultiPassEffect.ts
export class MyMultiPassEffect {
  private gl: WebGL2RenderingContext;
  private framebufferManager: FramebufferManager;
  private pass1Program: ShaderProgram;
  private pass2Program: ShaderProgram;

  constructor(gl: WebGL2RenderingContext, framebufferManager: FramebufferManager) {
    this.gl = gl;
    this.framebufferManager = framebufferManager;
    this.compileShaders();
  }

  private compileShaders(): void {
    // Compile your shaders
  }

  public apply(
    inputTexture: WebGLTexture,
    outputFramebuffer: WebGLFramebuffer | null,
    width: number,
    height: number,
    strength: number,
    vao: WebGLVertexArrayObject,
    positionBuffer: WebGLBuffer,
    texCoordBuffer: WebGLBuffer
  ): void {
    // Pass 1: Render to intermediate framebuffer
    const { framebuffer: fb1, texture: tex1 } = this.framebufferManager.getFramebuffer({
      width,
      height,
      format: 'rgba16f',
    });

    this.framebufferManager.bindFramebuffer(fb1);
    // ... render pass 1

    // Pass 2: Render to output
    this.framebufferManager.bindFramebuffer(outputFramebuffer);
    // ... render pass 2

    // Release intermediate framebuffer
    this.framebufferManager.releaseFramebuffer(fb1);
  }

  public dispose(): void {
    // Cleanup
  }
}
```

**Step 2: Integrate into pipeline**

```typescript
// In ShaderPipeline
private myMultiPassEffect: MyMultiPassEffect | null = null;

// In initialize()
this.myMultiPassEffect = new MyMultiPassEffect(this.gl, this.framebufferManager);

// In passes array
this.passes.push({ name: 'myMultiPassEffect', program: null, isDirty: true });

// In executeRender()
if (pass.name === 'myMultiPassEffect') {
  this.myMultiPassEffect.apply(
    inputTexture,
    outputFramebuffer,
    this.previewWidth,
    this.previewHeight,
    adjustments.myEffectStrength,
    this.quadGeometry.vao,
    this.quadGeometry.positionBuffer,
    this.quadGeometry.texCoordBuffer
  );
  continue;
}
```

---

## Testing and Debugging

### Unit Testing Shaders

```typescript
// src/engine/shaders/myEffect.test.ts
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test/webglTestUtils';
import { myEffectFragmentShader } from './myEffect';

describe('MyEffect Shader', () => {
  it('should compile successfully', () => {
    const { gl } = createTestContext();
    const shader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(shader, myEffectFragmentShader);
    gl.compileShader(shader);
    
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    expect(success).toBe(true);
  });

  it('should apply effect correctly', () => {
    // Test shader output
  });
});
```

### Visual Debugging

```typescript
// Render intermediate passes to separate canvases
function debugRenderPasses(pipeline: ShaderPipeline) {
  const passes = ['base', 'tonal', 'color', 'hsl', 'clarity', 'detail', 'effects', 'output'];
  
  passes.forEach((passName, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    document.body.appendChild(canvas);
    
    // Render pass to canvas
    // (requires pipeline modification to expose intermediate textures)
  });
}
```

### Performance Debugging

```typescript
// Log slow shader passes
const profile = pipeline.getPerformanceProfile();
profile.shaderPasses.forEach((pass, name) => {
  if (pass.averageExecutionTime > 10) {
    console.warn(`Slow pass: ${name} (${pass.averageExecutionTime.toFixed(2)}ms)`);
  }
});

// Get optimization recommendations
const recommendations = pipeline.getPerformanceRecommendations();
recommendations.forEach(rec => console.log(`💡 ${rec}`));
```

### WebGL Debugging

```typescript
// Enable WebGL error checking
function checkGLError(gl: WebGL2RenderingContext, operation: string) {
  const error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error(`WebGL error after ${operation}: ${error}`);
  }
}

// Use in development
pipeline.render(adjustments);
checkGLError(gl, 'render');
```

---

## Best Practices

### 1. Always Use Linear Color Space

```typescript
// ✓ Good
vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
color = color * 2.0;  // Process in linear
color = linearToSRGB(color);

// ✗ Bad
vec3 color = texture(u_texture, v_texCoord).rgb;
color = color * 2.0;  // Wrong! Processing in sRGB
```

### 2. Dispose Resources

```typescript
// ✓ Good
useEffect(() => {
  const pipeline = new ShaderPipeline(contextManager);
  return () => pipeline.dispose();
}, []);

// ✗ Bad
const pipeline = new ShaderPipeline(contextManager);
// Never disposed - memory leak!
```

### 3. Batch Adjustments

```typescript
// ✓ Good
const newAdjustments = {
  ...adjustments,
  exposure: 0.5,
  contrast: 1.2,
  saturation: 0.1,
};
pipeline.render(newAdjustments);

// ✗ Bad
setExposure(0.5);
pipeline.render(adjustments);
setContrast(1.2);
pipeline.render(adjustments);
setSaturation(0.1);
pipeline.render(adjustments);
```

### 4. Handle Errors

```typescript
// ✓ Good
try {
  pipeline.render(adjustments);
} catch (error) {
  errorHandler.handleError(error, { imageData, adjustments, canvas });
}

// ✗ Bad
pipeline.render(adjustments);  // Unhandled errors
```

### 5. Monitor Performance

```typescript
// ✓ Good
if (pipeline.isLowPerformance()) {
  showPerformanceWarning();
  // Consider reducing quality
}

// ✗ Bad
// Never check performance
```

### 6. Use Quality Modes Appropriately

```typescript
// ✓ Good
// Preview mode for editing
pipeline.setQualityMode('preview');

// Export mode for final output
pipeline.setQualityMode('export');
const result = await exportRenderer.renderForExport(imageData, adjustments);

// ✗ Bad
// Always use export mode (slow)
pipeline.setQualityMode('export');
```

### 7. Document Custom Shaders

```glsl
/**
 * Apply custom effect
 * 
 * Detailed description of what this shader does.
 * 
 * @param color - Input color in linear RGB [0-1]
 * @param strength - Effect strength [0-1]
 * @return Processed color in linear RGB [0-1]
 */
vec3 applyCustomEffect(vec3 color, float strength) {
    // Implementation
}
```

---

## API Reference

### ShaderPipeline

#### Constructor

```typescript
constructor(
  contextManager: WebGLContextManager,
  config?: Partial<PipelineConfig>
)
```

#### Methods

**Image Loading**
- `loadImage(imageData: ImageData): void`

**Rendering**
- `render(adjustments: AdjustmentState): void`
- `renderToImageData(imageData: ImageData, adjustments: AdjustmentState): Promise<ImageData>`

**Configuration**
- `setQualityMode(mode: 'preview' | 'export'): void`
- `getQualityMode(): 'preview' | 'export'`
- `setToneMappingEnabled(enabled: boolean): void`
- `setToneMappingMode(mode: 'reinhard' | 'aces'): void`
- `setPerformanceMonitoringEnabled(enabled: boolean): void`
- `setRenderSchedulerEnabled(enabled: boolean): void`
- `setFrameSkippingEnabled(enabled: boolean): void`

**Performance**
- `getPerformanceProfile(): PerformanceProfile`
- `getPerformanceRecommendations(): string[]`
- `exportPerformanceProfile(): string`
- `resetPerformanceStats(): void`
- `getFPS(): number`
- `isLowPerformance(): boolean`

**Dimensions**
- `getPreviewDimensions(): { width: number; height: number }`
- `getImageDimensions(): { width: number; height: number }`
- `isUsingDownscaledPreview(): boolean`

**Cleanup**
- `dispose(): void`

### ShaderComposer

#### Methods

- `registerModule(module: ShaderModule): void`
- `getModule(name: string): ShaderModule | undefined`
- `listModules(): string[]`
- `compose(source: string, visited?: Set<string>): string`
- `createShader(fragmentSource: string, includes: string[]): string`
- `clearCache(): void`
- `getCacheStats(): { modules: number; cached: number }`

### ExportRenderer

#### Methods

- `renderForExport(imageData: ImageData, adjustments: AdjustmentState, options?: ExportOptions): Promise<ImageData>`
- `dispose(): void`

---

## Additional Resources

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Shader Architecture](./SHADER_ARCHITECTURE.md)
- [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)
- [Shader Library README](../../engine/shaders/README.md)
- [Shader Conventions](../../engine/shaders/SHADER_CONVENTIONS.md)

---

**Last Updated**: November 2024  
**Version**: 2.0.0  
**Maintainer**: Pixaro Development Team
