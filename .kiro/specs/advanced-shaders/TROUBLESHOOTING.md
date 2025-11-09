# Troubleshooting Guide: Advanced Shader Pipeline

## Overview

This guide helps you diagnose and fix common issues with the advanced shader pipeline.

**Quick Links:**
- [Common Issues](#common-issues)
- [Error Messages](#error-messages)
- [Performance Problems](#performance-problems)
- [Visual Artifacts](#visual-artifacts)
- [Browser-Specific Issues](#browser-specific-issues)
- [Debugging Tools](#debugging-tools)

---

## Common Issues

### Issue 1: WebGL Context Creation Failed

**Symptoms:**
- Error: "Failed to create WebGL2 context"
- Black canvas
- No rendering

**Causes:**
1. Browser doesn't support WebGL 2
2. GPU blacklisted
3. Too many WebGL contexts
4. Hardware acceleration disabled

**Solutions:**

```typescript
// Check WebGL 2 support
function checkWebGL2Support(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    console.error('WebGL 2 not supported');
    return false;
  }
  return true;
}

// Use fallback
if (!checkWebGL2Support()) {
  // Show error message to user
  showError('Your browser does not support WebGL 2. Please update your browser.');
  // Or use Canvas 2D fallback
  useCanvasFallback();
}
```

**Prevention:**
- Check WebGL support before initializing pipeline
- Limit number of WebGL contexts (max 16 per page)
- Dispose old contexts before creating new ones

---

### Issue 2: Shader Compilation Failed

**Symptoms:**
- Error: "Shader compilation failed"
- Console shows GLSL errors
- Rendering doesn't work

**Causes:**
1. Syntax error in shader code
2. Unsupported GLSL features
3. Missing #include dependencies
4. Version mismatch

**Solutions:**

```typescript
// Enable shader debugging
const composer = new ShaderComposer({ debug: true });
const composed = composer.compose(shaderSource);
console.log('Composed shader:', composed);

// Check for compilation errors
const shader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(shader, composed);
gl.compileShader(shader);

if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
  const error = gl.getShaderInfoLog(shader);
  console.error('Shader compilation error:', error);
}
```

**Common GLSL Errors:**

```glsl
// ✗ Bad: Missing semicolon
vec3 color = texture(u_texture, v_texCoord).rgb

// ✓ Good
vec3 color = texture(u_texture, v_texCoord).rgb;

// ✗ Bad: Wrong function name
vec3 linear = srgbToLinear(color);  // Case sensitive!

// ✓ Good
vec3 linear = sRGBToLinear(color);

// ✗ Bad: Unresolved include
#include "nonexistentModule"

// ✓ Good
#include "colorSpaceUtils"
```

---

### Issue 3: Performance is Slow

**Symptoms:**
- FPS below 30
- Laggy slider adjustments
- High frame times

**Diagnosis:**

```typescript
// Check performance profile
const profile = pipeline.getPerformanceProfile();

console.log('Performance Metrics:');
console.log(`  FPS: ${profile.render.currentFPS}`);
console.log(`  Frame Time: ${profile.render.averageFrameTime}ms`);
console.log(`  GPU Memory: ${profile.gpuMemoryUsageMB}MB`);

// Find bottlenecks
profile.shaderPasses.forEach((pass, name) => {
  if (pass.averageExecutionTime > 10) {
    console.warn(`Slow pass: ${name} (${pass.averageExecutionTime}ms)`);
  }
});

// Get recommendations
const recommendations = pipeline.getPerformanceRecommendations();
recommendations.forEach(rec => console.log(`💡 ${rec}`));
```

**Solutions:**

1. **Reduce Preview Size**
```typescript
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: 1024,  // Reduce from 2048
});
```

2. **Disable Expensive Effects**
```typescript
const adjustments = {
  ...baseAdjustments,
  clarity: 0,              // Multi-pass effect
  noiseReductionLuma: 0,
  noiseReductionColor: 0,
};
```

3. **Enable Frame Skipping**
```typescript
pipeline.setFrameSkippingEnabled(true);
```

4. **Check GPU Memory**
```typescript
const profile = pipeline.getPerformanceProfile();
if (profile.gpuMemoryUsageMB > 500) {
  console.warn('High GPU memory usage');
  // Consider reducing image size
}
```

---

### Issue 4: Colors Look Wrong

**Symptoms:**
- Colors appear washed out or oversaturated
- Highlights are blown out
- Shadows are crushed

**Causes:**
1. Incorrect color space conversion
2. Missing tone mapping
3. Out-of-range values
4. Wrong adjustment values

**Solutions:**

1. **Check Color Space Conversion**
```glsl
// Ensure proper conversion
vec3 color = sRGBToLinear(texture(u_texture, v_texCoord).rgb);
// ... process in linear space
color = linearToSRGB(color);
```

2. **Enable Tone Mapping for HDR**
```typescript
pipeline.setToneMappingEnabled(true);
pipeline.setToneMappingMode('reinhard');  // Or 'aces'
```

3. **Clamp Values**
```glsl
color = clamp(color, 0.0, 1.0);
```

4. **Check Adjustment Ranges**
```typescript
// Ensure values are in valid ranges
const adjustments = {
  exposure: clamp(exposure, -5, 5),
  contrast: clamp(contrast, 0, 2),
  highlights: clamp(highlights, -1, 1),
  // ...
};
```

---

### Issue 5: Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Browser becomes slow
- Eventually crashes

**Diagnosis:**

```typescript
// Monitor memory usage
setInterval(() => {
  const profile = pipeline.getPerformanceProfile();
  console.log(`GPU Memory: ${profile.gpuMemoryUsageMB}MB`);
  
  if (performance.memory) {
    console.log(`Heap: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
  }
}, 5000);
```

**Solutions:**

1. **Always Dispose Pipeline**
```typescript
// ✓ Good
useEffect(() => {
  const pipeline = new ShaderPipeline(contextManager);
  return () => pipeline.dispose();
}, []);

// ✗ Bad
const pipeline = new ShaderPipeline(contextManager);
// Never disposed!
```

2. **Dispose Old Images**
```typescript
// When loading new image
pipeline.loadImage(newImageData);
// Old textures are automatically cleaned up
```

3. **Clear Framebuffer Pool**
```typescript
// Periodically clear unused framebuffers
framebufferManager.cleanupUnusedFramebuffers();
```

---

### Issue 6: WebGL Context Lost

**Symptoms:**
- Error: "WebGL context lost"
- Rendering stops working
- Canvas goes black

**Causes:**
1. GPU driver crash
2. Too much GPU memory used
3. Browser tab backgrounded for too long
4. GPU reset

**Solutions:**

```typescript
// Handle context loss
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.warn('WebGL context lost');
  showError('Graphics context lost. Reloading...');
});

canvas.addEventListener('webglcontextrestored', () => {
  console.log('WebGL context restored');
  // Reinitialize pipeline
  const contextManager = new WebGLContextManager(canvas);
  const pipeline = new ShaderPipeline(contextManager);
  pipeline.loadImage(currentImageData);
  pipeline.render(currentAdjustments);
});

// Or use error handler
import { ShaderPipelineErrorHandler } from './engine/shaderPipelineErrorHandler';

const errorHandler = new ShaderPipelineErrorHandler(contextManager);
try {
  pipeline.render(adjustments);
} catch (error) {
  const result = errorHandler.handleError(error, {
    imageData,
    adjustments,
    canvas,
  });
  
  if (result.usedFallback) {
    console.log('Using fallback:', result.fallbackType);
  }
}
```

---

### Issue 7: Framebuffer Incomplete

**Symptoms:**
- Error: "Framebuffer is not complete"
- Multi-pass effects don't work
- Rendering fails

**Causes:**
1. RGBA16F not supported
2. Framebuffer dimensions too large
3. Attachment mismatch

**Solutions:**

```typescript
// Check float texture support
const ext = gl.getExtension('EXT_color_buffer_float');
if (!ext) {
  console.warn('Float textures not supported, using RGBA8');
  // Pipeline automatically falls back to RGBA8
}

// Check framebuffer status
const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
if (status !== gl.FRAMEBUFFER_COMPLETE) {
  console.error('Framebuffer incomplete:', getStatusString(status));
}

function getStatusString(status: number): string {
  switch (status) {
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      return 'INCOMPLETE_ATTACHMENT';
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      return 'MISSING_ATTACHMENT';
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      return 'INCOMPLETE_DIMENSIONS';
    case gl.FRAMEBUFFER_UNSUPPORTED:
      return 'UNSUPPORTED';
    default:
      return `Unknown: ${status}`;
  }
}
```

---

## Error Messages

### "Failed to create WebGL2 context"

**Meaning**: Browser doesn't support WebGL 2 or it's disabled

**Fix**:
1. Update browser to latest version
2. Enable hardware acceleration in browser settings
3. Check if GPU is blacklisted
4. Use Canvas 2D fallback

### "Shader module 'X' not found"

**Meaning**: Trying to include a shader module that doesn't exist

**Fix**:
1. Check module name spelling
2. Ensure module is registered in ShaderComposer
3. Check for typos in #include directive

```typescript
// Register missing module
shaderComposer.registerModule({
  name: 'myModule',
  source: myModuleGLSL,
  dependencies: [],
  version: '1.0.0',
  description: 'My module',
});
```

### "Circular dependency detected"

**Meaning**: Shader modules have circular #include references

**Fix**:
1. Refactor modules to remove circular dependencies
2. Move shared code to a common module

```
// Bad: A includes B, B includes A
moduleA.glsl: #include "moduleB"
moduleB.glsl: #include "moduleA"

// Good: Both include common module
moduleA.glsl: #include "common"
moduleB.glsl: #include "common"
common.glsl: // Shared code
```

### "Framebuffer creation failed"

**Meaning**: Failed to create framebuffer for multi-pass rendering

**Fix**:
1. Check if dimensions are too large
2. Verify float texture support
3. Check GPU memory availability

```typescript
// Reduce framebuffer size
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: 1024,  // Smaller framebuffers
});
```

---

## Performance Problems

### Low FPS (<30)

**Diagnosis:**
```typescript
const profile = pipeline.getPerformanceProfile();
console.log(`FPS: ${profile.render.currentFPS}`);
console.log(`Frame Time: ${profile.render.averageFrameTime}ms`);

// Check which pass is slow
profile.shaderPasses.forEach((pass, name) => {
  console.log(`${name}: ${pass.averageExecutionTime.toFixed(2)}ms`);
});
```

**Solutions:**
1. Reduce preview size
2. Disable expensive effects (clarity, noise reduction)
3. Enable frame skipping
4. Check GPU memory usage
5. Close other GPU-intensive applications

### High Frame Time (>33ms)

**Diagnosis:**
```typescript
// Identify bottleneck
const slowPasses = Array.from(profile.shaderPasses.entries())
  .filter(([_, pass]) => pass.averageExecutionTime > 10)
  .sort((a, b) => b[1].averageExecutionTime - a[1].averageExecutionTime);

console.log('Slow passes:', slowPasses);
```

**Solutions:**
1. Optimize slow shader passes
2. Reduce texture sampling
3. Use simpler algorithms
4. Split complex passes into multiple simpler ones

### Texture Upload Slow

**Diagnosis:**
```typescript
const profile = pipeline.getPerformanceProfile();
console.log(`Texture uploads: ${profile.textureUploads.count}`);
console.log(`Average time: ${profile.textureUploads.averageTime}ms`);
console.log(`Reuse ratio: ${profile.textureUploads.reuseRatio * 100}%`);
```

**Solutions:**
1. Ensure texture reuse is working
2. Reduce image size before upload
3. Use appropriate texture format
4. Avoid frequent texture recreation

---

## Visual Artifacts

### Banding in Gradients

**Cause**: 8-bit precision insufficient

**Fix**:
```typescript
// Enable dithering for export
const exportRenderer = new ExportRenderer(contextManager);
const result = await exportRenderer.renderForExport(imageData, adjustments, {
  enableDithering: true,
});
```

### Halos Around Edges

**Cause**: Clarity or sharpening too strong

**Fix**:
```typescript
// Reduce clarity/sharpening
const adjustments = {
  ...baseAdjustments,
  clarity: 0.3,      // Reduce from 0.5
  sharpening: 0.3,   // Reduce from 0.5
};
```

### Color Fringing

**Cause**: Sharpening applied to color channels

**Fix**: Sharpening is already applied to luminance only in the pipeline. If you see fringing, reduce sharpening amount.

### Blocky Noise

**Cause**: Grain size too large

**Fix**:
```typescript
const adjustments = {
  ...baseAdjustments,
  grain: {
    amount: 0.1,
    size: 0.5,  // Reduce from 1.0
  },
};
```

---

## Browser-Specific Issues

### Safari

**Issue**: Float textures not supported on older versions

**Fix**:
```typescript
// Check support
const ext = gl.getExtension('EXT_color_buffer_float');
if (!ext) {
  console.warn('Float textures not supported, using RGBA8');
  // Pipeline automatically falls back
}
```

**Issue**: WebGL context limit (8 contexts)

**Fix**:
```typescript
// Dispose old contexts
oldPipeline.dispose();
// Then create new one
const newPipeline = new ShaderPipeline(contextManager);
```

### Firefox

**Issue**: Slower shader compilation

**Fix**:
```typescript
// Shaders are compiled upfront during initialization
// No additional fix needed
```

### Chrome

**Issue**: GPU process crash on some drivers

**Fix**:
```typescript
// Handle context loss
canvas.addEventListener('webglcontextlost', handleContextLost);
canvas.addEventListener('webglcontextrestored', handleContextRestored);
```

### Mobile Browsers

**Issue**: Limited GPU memory

**Fix**:
```typescript
// Use smaller preview size on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const pipeline = new ShaderPipeline(contextManager, {
  maxPreviewSize: isMobile ? 1024 : 2048,
});
```

---

## Debugging Tools

### Performance Dashboard

```typescript
import { PerformanceDashboard } from './components/PerformanceDashboard';

<PerformanceDashboard
  getProfile={() => pipeline.getPerformanceProfile()}
  getRecommendations={() => pipeline.getPerformanceRecommendations()}
  onReset={() => pipeline.resetPerformanceStats()}
  onExport={() => {
    const json = pipeline.exportPerformanceProfile();
    downloadJSON(json, 'performance-profile.json');
  }}
  visible={true}
/>
```

### WebGL Inspector

Use [Spector.js](https://spector.babylonjs.com/) to inspect WebGL calls:

```html
<script src="https://spectorcdn.babylonjs.com/spector.bundle.js"></script>
<script>
  const spector = new SPECTOR.Spector();
  spector.displayUI();
</script>
```

### Chrome DevTools

1. Open DevTools (F12)
2. Go to Performance tab
3. Record while adjusting sliders
4. Analyze frame times and GPU usage

### Console Logging

```typescript
// Enable detailed logging
const pipeline = new ShaderPipeline(contextManager, {
  enablePerformanceMonitoring: true,
});

// Log every render
pipeline.render(adjustments);
const profile = pipeline.getPerformanceProfile();
console.log('Render complete:', {
  fps: profile.render.currentFPS,
  frameTime: profile.render.lastFrameTime,
  gpuMemory: profile.gpuMemoryUsageMB,
});
```

---

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review error messages in console
3. Check browser console for WebGL errors
4. Test in different browsers
5. Try with a smaller image
6. Disable effects one by one to isolate issue

### Information to Provide

When reporting issues, include:

```typescript
// System information
console.log('Browser:', navigator.userAgent);
console.log('WebGL Version:', gl.getParameter(gl.VERSION));
console.log('Renderer:', gl.getParameter(gl.RENDERER));
console.log('Vendor:', gl.getParameter(gl.VENDOR));

// Performance profile
const profile = pipeline.getPerformanceProfile();
console.log('Performance:', JSON.stringify(profile, null, 2));

// Image dimensions
console.log('Image:', pipeline.getImageDimensions());
console.log('Preview:', pipeline.getPreviewDimensions());

// Configuration
console.log('Quality Mode:', pipeline.getQualityMode());
console.log('Tone Mapping:', pipeline.config.enableToneMapping);
```

### Support Channels

- **GitHub Issues**: [Report a bug](https://github.com/your-repo/issues)
- **Slack**: #pixaro-dev
- **Email**: dev-support@pixaro.com
- **Documentation**: [Developer Guide](./DEVELOPER_GUIDE.md)

---

## FAQ

### Q: Why are colors different from the old pipeline?

**A**: The new pipeline uses proper linear color space for processing, which produces more accurate colors. This is expected and correct behavior.

### Q: Can I disable color space conversion?

**A**: No, proper color space conversion is fundamental to the pipeline's accuracy. Disabling it would break many features.

### Q: Why is clarity slower than before?

**A**: The new clarity uses proper Gaussian blur (multi-pass) for better quality. You can disable it if performance is critical.

### Q: How do I export at full resolution?

**A**: Use `ExportRenderer` instead of rendering directly:

```typescript
import { ExportRenderer } from './engine/exportRenderer';
const exportRenderer = new ExportRenderer(contextManager);
const result = await exportRenderer.renderForExport(imageData, adjustments);
```

### Q: Can I use the pipeline in a Web Worker?

**A**: No, WebGL requires a canvas which is only available in the main thread. However, you can use OffscreenCanvas in browsers that support it.

### Q: How do I reduce memory usage?

**A**: 
1. Use smaller preview size
2. Dispose pipeline when not needed
3. Limit number of WebGL contexts
4. Clear framebuffer pool periodically

---

**Last Updated**: November 2024  
**Version**: 2.0.0  
**Maintainer**: Pixaro Development Team
