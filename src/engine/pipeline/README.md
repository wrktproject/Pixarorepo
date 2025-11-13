# Pipeline Infrastructure

This directory contains the core infrastructure for the Darktable-inspired shader processing pipeline.

## Components

### ShaderRegistry

Advanced shader compilation system with:
- **Shader source validation** - Detects common issues before compilation
- **Detailed error reporting** - Shows error line numbers and context
- **Automatic caching** - Reuses compiled shaders for better performance
- **WebGL context recovery** - Automatically recompiles shaders after context loss

```typescript
const registry = new ShaderRegistry(gl, {
  enableValidation: true,
  enableCaching: true,
  logErrors: true,
});

registry.registerProgram(
  'myShader',
  vertexSource,
  fragmentSource,
  ['u_texture', 'u_exposure'],
  ['a_position', 'a_texCoord']
);

registry.useProgram('myShader');
```

### TexturePool

Efficient texture management with:
- **Texture pooling** - Reuses framebuffers to reduce allocations
- **Automatic sizing** - Handles texture dimensions automatically
- **Float16/Float32 support** - High-precision textures for image processing
- **Memory monitoring** - Tracks and reports GPU memory usage

```typescript
const pool = new TexturePool(gl, {
  maxPoolSize: 50,
  maxMemoryMB: 512,
  enableAutoCleanup: true,
});

// Acquire a texture
const texture = pool.acquire({
  width: 1920,
  height: 1080,
  format: 'rgba16f',
});

// Use texture...

// Release back to pool
pool.release(texture);
```

### PipelineDebugger

Debugging and profiling tools:
- **Intermediate stage visualization** - Capture and inspect pipeline stages
- **Performance profiling** - Per-module timing with CPU and GPU metrics
- **Texture inspection** - Debug texture contents
- **Performance reports** - Generate detailed performance analysis

```typescript
const debugger = new PipelineDebugger(gl, {
  enableProfiling: true,
  enableVisualization: true,
  captureIntermediates: false,
});

// Profile a frame
const frameStart = debugger.startFrame();

// Profile a pass
const passStart = debugger.startPass('exposure');
// ... render pass ...
debugger.endPass('exposure', passStart);

debugger.endFrame(frameStart);

// Get performance data
const summary = debugger.getPerformanceSummary();
console.log(`Average FPS: ${summary.avgFPS}`);
console.log(debugger.generateReport());
```

### PipelineManager

Orchestrates the entire pipeline:
- **Module management** - Register and enable/disable processing modules
- **Dependency resolution** - Automatically orders modules based on dependencies
- **State tracking** - Dirty flagging for efficient re-rendering
- **Unified execution** - Coordinates all subsystems

```typescript
const pipeline = new PipelineManager(gl, {
  enableDebugger: true,
  enableProfiling: true,
  maxTexturePoolSize: 50,
  maxMemoryMB: 512,
});

// Register a module
pipeline.registerModule({
  name: 'exposure',
  enabled: true,
  shader: {
    vertex: exposureVertexShader,
    fragment: exposureFragmentShader,
  },
  uniforms: ['u_texture', 'u_exposure'],
  attributes: ['a_position', 'a_texCoord'],
  dependencies: [], // Optional: modules this depends on
});

// Execute pipeline
pipeline.execute({
  inputTexture: sourceTexture,
  outputFramebuffer: null, // null = render to canvas
  width: 1920,
  height: 1080,
  uniforms: {
    u_exposure: 1.5,
  },
});

// Get statistics
const stats = pipeline.getStats();
console.log(`Enabled modules: ${stats.enabledModules}`);
console.log(`Memory used: ${stats.texturePool.memoryUsedMB.toFixed(2)}MB`);
```

## Architecture

The pipeline follows a modular architecture:

```
PipelineManager
├── ShaderRegistry (shader compilation & caching)
├── TexturePool (texture management & pooling)
└── PipelineDebugger (profiling & visualization)
```

### Processing Flow

1. **Module Registration** - Register shader modules with dependencies
2. **Dependency Resolution** - Compute execution order
3. **Pipeline Execution**:
   - Start frame profiling
   - For each enabled module:
     - Check if dirty (needs re-execution)
     - Acquire intermediate texture from pool
     - Execute shader pass
     - Profile performance
   - Release textures back to pool
   - End frame profiling

### Memory Management

The pipeline uses efficient memory management:
- **Texture Pooling** - Reuses textures across frames
- **Automatic Cleanup** - Removes unused textures periodically
- **Memory Limits** - Enforces maximum memory usage
- **LRU Eviction** - Evicts least recently used textures when needed

### Error Handling

Comprehensive error handling:
- **Shader Compilation Errors** - Detailed error messages with line numbers
- **WebGL Context Loss** - Automatic recovery and recompilation
- **Memory Pressure** - Graceful degradation when memory is low
- **Validation Warnings** - Catches common shader issues early

## Performance

The pipeline is optimized for real-time performance:
- **Shader Caching** - Compiled shaders are cached
- **Texture Pooling** - Reduces allocation overhead
- **Dirty Flagging** - Only re-executes changed modules
- **GPU Profiling** - Identifies performance bottlenecks

Typical performance on modern hardware:
- **Shader Compilation** - < 10ms per shader (cached: < 1ms)
- **Texture Acquisition** - < 1ms (from pool)
- **Module Execution** - 1-5ms per module (depends on complexity)
- **Frame Time** - 16-33ms (30-60 FPS) for typical pipeline

## Usage Example

Complete example of setting up and using the pipeline:

```typescript
import { PipelineManager } from './pipeline';

// Initialize pipeline
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2');
if (!gl) throw new Error('WebGL2 not supported');

const pipeline = new PipelineManager(gl, {
  enableDebugger: true,
  enableProfiling: true,
});

// Register modules
pipeline.registerModule({
  name: 'base',
  enabled: true,
  shader: { vertex: baseVS, fragment: baseFS },
  uniforms: ['u_texture'],
  attributes: ['a_position', 'a_texCoord'],
});

pipeline.registerModule({
  name: 'exposure',
  enabled: true,
  shader: { vertex: exposureVS, fragment: exposureFS },
  uniforms: ['u_texture', 'u_exposure'],
  attributes: ['a_position', 'a_texCoord'],
  dependencies: ['base'],
});

pipeline.registerModule({
  name: 'tonemap',
  enabled: true,
  shader: { vertex: tonemapVS, fragment: tonemapFS },
  uniforms: ['u_texture', 'u_contrast'],
  attributes: ['a_position', 'a_texCoord'],
  dependencies: ['exposure'],
});

// Load image
const sourceTexture = loadImageAsTexture(gl, 'image.jpg');

// Render loop
function render() {
  pipeline.execute({
    inputTexture: sourceTexture,
    outputFramebuffer: null,
    width: canvas.width,
    height: canvas.height,
    uniforms: {
      u_exposure: 1.5,
      u_contrast: 1.2,
    },
  });

  // Log performance
  const stats = pipeline.getStats();
  console.log(`FPS: ${stats.performance.avgFPS.toFixed(1)}`);

  requestAnimationFrame(render);
}

render();
```

## Testing

The pipeline components should be tested for:
- Shader compilation with valid and invalid shaders
- Texture pooling and memory management
- Module dependency resolution
- Performance profiling accuracy
- WebGL context loss recovery

## Future Enhancements

Potential improvements:
- **Compute Shaders** - Use compute shaders for non-rendering operations
- **Multi-pass Effects** - Support for effects requiring multiple passes
- **Async Compilation** - Compile shaders asynchronously
- **Pipeline Presets** - Save and load pipeline configurations
- **Hot Reload** - Reload shaders without restarting
