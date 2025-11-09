# Migration Guide: Old Shader Pipeline → Advanced Shader Pipeline

## Overview

This guide helps you migrate from the legacy shader pipeline to the new advanced shader system with Lightroom-quality adjustments, proper color science, and multi-pass rendering.

**Migration Complexity**: Medium  
**Estimated Time**: 2-4 hours  
**Breaking Changes**: Yes (API changes required)

---

## Table of Contents

1. [What's Changed](#whats-changed)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Migration](#step-by-step-migration)
4. [API Changes](#api-changes)
5. [Adjustment Value Mapping](#adjustment-value-mapping)
6. [Testing Your Migration](#testing-your-migration)
7. [Rollback Strategy](#rollback-strategy)
8. [Common Issues](#common-issues)

---

## What's Changed

### Architecture Changes

| Aspect | Old Pipeline | New Pipeline |
|--------|-------------|--------------|
| **Color Space** | sRGB throughout | Linear RGB for processing |
| **Passes** | Single-pass | Multi-pass with framebuffers |
| **Precision** | RGBA8 | RGBA16F (half-float) |
| **Tone Mapping** | None | Reinhard/ACES support |
| **Clarity** | Simple shader | Two-pass Gaussian blur |
| **Performance** | Direct render | Render scheduler + batching |
| **Error Handling** | Basic | Comprehensive with fallbacks |

### New Features

✅ **Accurate Color Science**: Proper sRGB ↔ linear conversions  
✅ **Multi-Pass Effects**: Clarity, blur, sharpening  
✅ **Performance Optimization**: Dirty flags, batching, frame skipping  
✅ **Quality Modes**: Preview (downscaled) vs Export (full resolution)  
✅ **Tone Mapping**: HDR support with multiple algorithms  
✅ **Profiling**: Comprehensive performance monitoring  
✅ **Modular Shaders**: Composable shader library system  

### Removed Features

❌ **Legacy Shader Format**: Old shader structure no longer supported  
❌ **Direct Canvas Rendering**: Now uses framebuffer pipeline  
❌ **Synchronous Rendering**: All rendering is now async/scheduled  

---

## Prerequisites

### Browser Requirements

- WebGL 2.0 support (required)
- `EXT_color_buffer_float` extension (recommended, fallback available)
- Modern browser (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+)

### Code Requirements

```typescript
// Check WebGL 2 support
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
if (!gl) {
  console.error('WebGL 2 not supported');
  // Use fallback or show error
}
```

### Dependencies

Ensure you have the latest versions:

```json
{
  "dependencies": {
    "@types/webgl2": "^0.0.7"
  }
}
```

---

## Step-by-Step Migration

### Step 1: Update Imports

**Old:**
```typescript
import { ShaderPipeline } from './engine/shaderPipeline.old';
```

**New:**
```typescript
import { ShaderPipeline } from './engine/shaderPipeline';
import { WebGLContextManager } from './engine/webglContext';
```

### Step 2: Initialize Context Manager

**Old:**
```typescript
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');
const pipeline = new ShaderPipeline(gl);
```

**New:**
```typescript
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const contextManager = new WebGLContextManager(canvas);
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: 2048,
  enableToneMapping: false,
  enablePerformanceMonitoring: true,
  qualityMode: 'preview',
  enableRenderScheduler: true,
  targetFPS: 60,
  minFPS: 30,
});
```

### Step 3: Update Image Loading

**Old:**
```typescript
pipeline.loadImage(imageData);
pipeline.render(adjustments);
```

**New:**
```typescript
// Load image (automatically handles downscaling in preview mode)
pipeline.loadImage(imageData);

// Render is now scheduled and batched automatically
pipeline.render(adjustments);
```

### Step 4: Update Adjustment Values

Some adjustment ranges have changed for better accuracy:

**Old:**
```typescript
const adjustments = {
  exposure: 0.5,      // 0-1 range
  contrast: 1.2,      // 0-2 range
  temperature: 50,    // -100 to +100
  // ...
};
```

**New:**
```typescript
const adjustments = {
  exposure: 0.5,      // -5 to +5 stops (photographic)
  contrast: 1.2,      // 0-2 range (same)
  temperature: 50,    // -100 to +100 (same)
  whites: 0,          // NEW: -1 to +1
  blacks: 0,          // NEW: -1 to +1
  clarity: 0,         // 0-1 (now multi-pass)
  // ...
};
```

### Step 5: Handle Export

**Old:**
```typescript
// Render to canvas, then export
pipeline.render(adjustments);
const imageData = ctx.getImageData(0, 0, width, height);
```

**New:**
```typescript
// Use dedicated export renderer for full resolution
import { ExportRenderer } from './engine/exportRenderer';

const exportRenderer = new ExportRenderer(contextManager);
const fullResImageData = await exportRenderer.renderForExport(
  originalImageData,
  adjustments,
  {
    enableDithering: true,
    toneMappingMode: 'aces',
  }
);
```

### Step 6: Add Error Handling

**Old:**
```typescript
try {
  pipeline.render(adjustments);
} catch (error) {
  console.error('Render failed:', error);
}
```

**New:**
```typescript
import { ShaderPipelineErrorHandler } from './engine/shaderPipelineErrorHandler';

const errorHandler = new ShaderPipelineErrorHandler(contextManager);

try {
  pipeline.render(adjustments);
} catch (error) {
  const fallback = errorHandler.handleError(error, {
    imageData: originalImageData,
    adjustments,
    canvas,
  });
  
  if (fallback.usedFallback) {
    console.warn('Using fallback renderer:', fallback.fallbackType);
  }
}
```

### Step 7: Add Performance Monitoring (Optional)

**New Feature:**
```typescript
// Get performance metrics
const profile = pipeline.getPerformanceProfile();
console.log(`FPS: ${profile.render.currentFPS}`);
console.log(`Frame Time: ${profile.render.averageFrameTime}ms`);

// Get recommendations
const recommendations = pipeline.getPerformanceRecommendations();
recommendations.forEach(rec => console.log(`💡 ${rec}`));

// Show performance indicator
if (pipeline.isLowPerformance()) {
  showPerformanceWarning();
}
```

### Step 8: Update Cleanup

**Old:**
```typescript
// Manual cleanup
gl.deleteTexture(texture);
gl.deleteFramebuffer(framebuffer);
```

**New:**
```typescript
// Automatic cleanup
pipeline.dispose();
```

---

## API Changes

### Constructor

**Old:**
```typescript
new ShaderPipeline(gl: WebGL2RenderingContext)
```

**New:**
```typescript
new ShaderPipeline(
  contextManager: WebGLContextManager,
  config?: Partial<PipelineConfig>
)
```

### Configuration Options

```typescript
interface PipelineConfig {
  maxPreviewSize: number;              // Default: 2048
  enableToneMapping: boolean;          // Default: false
  toneMappingMode: 'reinhard' | 'aces'; // Default: 'reinhard'
  enablePerformanceMonitoring: boolean; // Default: true
  qualityMode: 'preview' | 'export';   // Default: 'preview'
  enableRenderScheduler: boolean;      // Default: true
  targetFPS: number;                   // Default: 60
  minFPS: number;                      // Default: 30
}
```

### New Methods

```typescript
// Performance monitoring
pipeline.getPerformanceProfile(): PerformanceProfile
pipeline.getPerformanceRecommendations(): string[]
pipeline.exportPerformanceProfile(): string
pipeline.resetPerformanceStats(): void

// Quality control
pipeline.setQualityMode(mode: 'preview' | 'export'): void
pipeline.getQualityMode(): 'preview' | 'export'
pipeline.isUsingDownscaledPreview(): boolean

// Tone mapping
pipeline.setToneMappingEnabled(enabled: boolean): void
pipeline.setToneMappingMode(mode: 'reinhard' | 'aces'): void

// Render control
pipeline.setRenderSchedulerEnabled(enabled: boolean): void
pipeline.setFrameSkippingEnabled(enabled: boolean): void

// Dimensions
pipeline.getPreviewDimensions(): { width: number; height: number }
pipeline.getImageDimensions(): { width: number; height: number }
```

### Changed Methods

```typescript
// render() is now async/scheduled
// Old: Immediate render
pipeline.render(adjustments);

// New: Scheduled render (batched automatically)
pipeline.render(adjustments);
// Actual render happens in next animation frame
```

### Removed Methods

```typescript
// These methods no longer exist:
pipeline.setShaderProgram()  // Now handled internally
pipeline.compileShader()     // Now handled by ShaderCompiler
pipeline.createFramebuffer() // Now handled by FramebufferManager
```

---

## Adjustment Value Mapping

### Exposure

**Old:** 0-1 range (arbitrary)  
**New:** -5 to +5 stops (photographic)

```typescript
// Migration formula
const newExposure = (oldExposure - 0.5) * 10; // Map 0-1 to -5 to +5
```

### Contrast

**No change:** 0-2 range (1.0 = neutral)

### Highlights/Shadows

**Old:** 0-1 range  
**New:** -1 to +1 range

```typescript
// Migration formula
const newHighlights = (oldHighlights - 0.5) * 2; // Map 0-1 to -1 to +1
const newShadows = (oldShadows - 0.5) * 2;
```

### New Adjustments

```typescript
// These are new in the advanced pipeline:
whites: number;              // -1 to +1 (extreme highlights)
blacks: number;              // -1 to +1 (extreme shadows)
clarity: number;             // 0-1 (now multi-pass, better quality)
noiseReductionLuma: number;  // 0-1 (luminance noise)
noiseReductionColor: number; // 0-1 (color noise)
```

### Complete Mapping Example

```typescript
function migrateAdjustments(oldAdj: OldAdjustments): AdjustmentState {
  return {
    // Tonal
    exposure: (oldAdj.exposure - 0.5) * 10,
    contrast: oldAdj.contrast,
    highlights: (oldAdj.highlights - 0.5) * 2,
    shadows: (oldAdj.shadows - 0.5) * 2,
    whites: 0,  // New, default to 0
    blacks: 0,  // New, default to 0
    
    // Color
    temperature: oldAdj.temperature,
    tint: oldAdj.tint,
    vibrance: oldAdj.vibrance,
    saturation: oldAdj.saturation,
    
    // HSL (unchanged)
    hsl: oldAdj.hsl,
    
    // Detail
    clarity: oldAdj.clarity,
    sharpening: oldAdj.sharpening,
    noiseReductionLuma: 0,    // New, default to 0
    noiseReductionColor: 0,   // New, default to 0
    
    // Effects (unchanged)
    vignette: oldAdj.vignette,
    grain: oldAdj.grain,
    
    // Geometric (unchanged)
    crop: oldAdj.crop,
    straighten: oldAdj.straighten,
  };
}
```

---

## Testing Your Migration

### 1. Visual Comparison Test

```typescript
// Render same image with old and new pipeline
const oldResult = oldPipeline.render(imageData, oldAdjustments);
const newResult = newPipeline.render(imageData, migrateAdjustments(oldAdjustments));

// Compare visually or use image diff tool
compareImages(oldResult, newResult);
```

### 2. Performance Test

```typescript
// Measure render time
const start = performance.now();
pipeline.render(adjustments);
const duration = performance.now() - start;

console.log(`Render time: ${duration}ms`);
// Target: <33ms for 30 FPS, <16ms for 60 FPS
```

### 3. Memory Test

```typescript
// Check GPU memory usage
const profile = pipeline.getPerformanceProfile();
console.log(`GPU Memory: ${profile.gpuMemoryUsageMB}MB`);

// Monitor for leaks
setInterval(() => {
  const mem = pipeline.getPerformanceProfile().gpuMemoryUsageMB;
  console.log(`Memory: ${mem}MB`);
}, 5000);
```

### 4. Error Handling Test

```typescript
// Test with invalid inputs
try {
  pipeline.loadImage(null);  // Should handle gracefully
} catch (error) {
  console.log('Error handled:', error.message);
}

// Test WebGL context loss
const canvas = pipeline.gl.canvas;
const loseContext = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
loseContext.loseContext();  // Simulate context loss
// Pipeline should recover or show error
```

### 5. Cross-Browser Test

Test on:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## Rollback Strategy

### Feature Flag Approach

```typescript
const USE_NEW_PIPELINE = true; // Feature flag

const pipeline = USE_NEW_PIPELINE
  ? new ShaderPipeline(contextManager, config)
  : new LegacyShaderPipeline(gl);
```

### Gradual Rollout

```typescript
// Roll out to percentage of users
const useNewPipeline = Math.random() < 0.1; // 10% of users

if (useNewPipeline) {
  // Use new pipeline
} else {
  // Use old pipeline
}
```

### Fallback on Error

```typescript
let pipeline;
try {
  pipeline = new ShaderPipeline(contextManager, config);
} catch (error) {
  console.warn('New pipeline failed, using legacy:', error);
  pipeline = new LegacyShaderPipeline(gl);
}
```

---

## Common Issues

### Issue 1: Colors Look Different

**Cause**: New pipeline uses linear color space for processing  
**Solution**: This is expected and correct. The new pipeline produces more accurate colors.

```typescript
// If you need to match old behavior (not recommended):
// Disable proper color space conversion (not available, by design)
// Instead, adjust your adjustment values to match
```

### Issue 2: Performance is Slower

**Cause**: Multi-pass rendering has overhead  
**Solution**: Enable performance optimizations

```typescript
const pipeline = new ShaderPipeline(contextManager, {
  enableRenderScheduler: true,  // Enable batching
  maxPreviewSize: 1024,         // Reduce preview size
  qualityMode: 'preview',       // Use preview mode
});
```

### Issue 3: WebGL Context Lost

**Cause**: GPU driver crash or resource exhaustion  
**Solution**: Use error handler with fallback

```typescript
import { ShaderPipelineErrorHandler } from './engine/shaderPipelineErrorHandler';

const errorHandler = new ShaderPipelineErrorHandler(contextManager);
errorHandler.handleError(error, { imageData, adjustments, canvas });
```

### Issue 4: Memory Leaks

**Cause**: Not disposing pipeline properly  
**Solution**: Always call dispose()

```typescript
// In cleanup/unmount
useEffect(() => {
  return () => {
    pipeline.dispose();
  };
}, []);
```

### Issue 5: Clarity Looks Different

**Cause**: New clarity uses proper Gaussian blur (multi-pass)  
**Solution**: Adjust clarity values (may need to reduce by ~30%)

```typescript
// Old clarity: 0.5
// New clarity: 0.35 (approximately)
const newClarity = oldClarity * 0.7;
```

### Issue 6: Export Quality Issues

**Cause**: Using preview mode for export  
**Solution**: Use ExportRenderer

```typescript
import { ExportRenderer } from './engine/exportRenderer';

const exportRenderer = new ExportRenderer(contextManager);
const result = await exportRenderer.renderForExport(imageData, adjustments);
```

### Issue 7: Tone Mapping Too Strong

**Cause**: Tone mapping enabled by default  
**Solution**: Disable or adjust

```typescript
pipeline.setToneMappingEnabled(false);
// Or use different mode
pipeline.setToneMappingMode('reinhard'); // Gentler than 'aces'
```

---

## Migration Checklist

- [ ] Update imports to new pipeline
- [ ] Initialize WebGLContextManager
- [ ] Update pipeline configuration
- [ ] Migrate adjustment values
- [ ] Update image loading code
- [ ] Update export code to use ExportRenderer
- [ ] Add error handling with fallbacks
- [ ] Add performance monitoring (optional)
- [ ] Update cleanup/dispose code
- [ ] Test visual output
- [ ] Test performance
- [ ] Test error handling
- [ ] Test on multiple browsers
- [ ] Test on mobile devices
- [ ] Update documentation
- [ ] Train team on new API

---

## Getting Help

### Resources

- [Developer Documentation](./DEVELOPER_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Shader Architecture](./SHADER_ARCHITECTURE.md)
- [Performance Profiling](../../engine/PERFORMANCE_PROFILING.md)

### Support

- GitHub Issues: [Report a bug](https://github.com/your-repo/issues)
- Slack: #pixaro-dev
- Email: dev-support@pixaro.com

---

**Last Updated**: November 2024  
**Version**: 2.0.0  
**Maintainer**: Pixaro Development Team
