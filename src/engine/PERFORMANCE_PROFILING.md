# Performance Profiling and Optimization

This document describes the comprehensive performance profiling system implemented for the shader pipeline.

## Overview

The performance profiling system provides detailed insights into:
- Shader execution times
- Texture upload performance
- Framebuffer pool efficiency
- Render call optimization
- GPU memory usage
- Real-time FPS monitoring

## Components

### PerformanceProfiler

The main profiling class that tracks all performance metrics.

```typescript
import { PerformanceProfiler } from './engine/performanceProfiler';

const profiler = new PerformanceProfiler({
  enabled: true,
  sampleSize: 60, // Keep last 60 samples
  logInterval: 5000, // Log every 5 seconds
  enableDetailedProfiling: true,
});
```

### Integration Points

#### ShaderPipeline
The profiler is integrated into the shader pipeline to track:
- Frame rendering times
- Individual shader pass execution
- Dirty flag optimization effectiveness

#### TextureManager
Tracks texture upload operations:
- Upload duration
- Data size
- Texture reuse vs. recreation

#### FramebufferManager
Monitors framebuffer pooling:
- Pool hits (reused framebuffers)
- Pool misses (new framebuffers created)
- Active framebuffer count

## Usage

### Basic Profiling

```typescript
// Get current performance profile
const profile = shaderPipeline.getPerformanceProfile();

console.log(`FPS: ${profile.render.currentFPS}`);
console.log(`Frame Time: ${profile.render.averageFrameTime}ms`);
console.log(`GPU Memory: ${profile.gpuMemoryUsageMB}MB`);
```

### Shader Pass Analysis

```typescript
const profile = shaderPipeline.getPerformanceProfile();

// Find slowest shader pass
const passes = Array.from(profile.shaderPasses.values());
const slowest = passes.sort((a, b) => 
  b.averageExecutionTime - a.averageExecutionTime
)[0];

console.log(`Slowest pass: ${slowest.name} (${slowest.averageExecutionTime}ms)`);
```

### Performance Recommendations

```typescript
const recommendations = shaderPipeline.getPerformanceRecommendations();

recommendations.forEach(rec => {
  console.log(`💡 ${rec}`);
});
```

### Export Profile Data

```typescript
// Export as JSON for analysis
const json = shaderPipeline.exportPerformanceProfile();
console.log(json);

// Or save to file
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// ... download logic
```

## Performance Metrics

### Render Metrics
- **Total Renders**: Number of frames rendered
- **Redundant Renders**: Renders that were batched/skipped
- **Average Frame Time**: Mean time to render a frame
- **Current FPS**: Frames per second
- **Dropped Frames**: Frames skipped due to performance

### Shader Pass Metrics
- **Execution Time**: Time to execute the pass
- **Call Count**: Number of times executed
- **Skipped Count**: Times skipped due to dirty flag optimization
- **Min/Max Times**: Performance range

### Texture Upload Metrics
- **Upload Count**: Total texture uploads
- **Total Bytes**: Amount of data uploaded
- **Average Time**: Mean upload duration
- **Reuse Ratio**: Percentage of textures reused vs. recreated

### Framebuffer Metrics
- **Pool Hits**: Framebuffers reused from pool
- **Pool Misses**: New framebuffers created
- **Pool Hit Ratio**: Efficiency of framebuffer pooling
- **Active Framebuffers**: Currently allocated framebuffers

### Memory Metrics
- **GPU Memory**: Estimated GPU memory usage
- **CPU Memory**: JavaScript heap usage (if available)

## Optimization Strategies

### 1. Shader Pass Optimization

If a shader pass is consistently slow:
- Review shader code for inefficiencies
- Reduce texture sampling operations
- Optimize mathematical operations
- Consider splitting into multiple simpler passes

### 2. Texture Upload Optimization

To improve texture upload performance:
- Reuse textures when dimensions match (already implemented)
- Use appropriate texture formats (RGBA8 vs RGBA16F)
- Batch texture updates when possible
- Consider texture compression

### 3. Framebuffer Pool Optimization

For better framebuffer pooling:
- Increase pool size if hit ratio is low
- Ensure framebuffers are released after use
- Monitor active framebuffer count
- Clean up unused framebuffers periodically

### 4. Render Call Optimization

To reduce redundant renders:
- Batch slider changes (already implemented via RenderScheduler)
- Use dirty flags to skip unchanged passes (already implemented)
- Implement frame skipping for slow renders (already implemented)
- Debounce rapid adjustment changes

### 5. Memory Optimization

To reduce memory usage:
- Use preview downscaling (already implemented)
- Clear texture cache periodically
- Limit framebuffer pool size
- Monitor for memory leaks

## Performance Targets

Based on Requirements 8.2 and 13.1:

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| FPS | 60 | 30-60 | <30 |
| Frame Time | <16ms | 16-33ms | >33ms |
| Single Pass | <5ms | 5-10ms | >10ms |
| Multi-Pass Effect | <33ms | 33-50ms | >50ms |
| Texture Upload | <10ms | 10-20ms | >20ms |
| Pool Hit Ratio | >80% | 50-80% | <50% |

## Performance Dashboard

A visual dashboard component is available for real-time monitoring:

```typescript
import { PerformanceDashboard } from './components/PerformanceDashboard';

<PerformanceDashboard
  getProfile={() => shaderPipeline.getPerformanceProfile()}
  getRecommendations={() => shaderPipeline.getPerformanceRecommendations()}
  onReset={() => shaderPipeline.resetPerformanceStats()}
  onExport={() => shaderPipeline.exportPerformanceProfile()}
  visible={showDashboard}
/>
```

The dashboard displays:
- Real-time FPS and frame time
- GPU memory usage
- Dropped frame count
- Detailed shader pass timings
- Texture upload statistics
- Framebuffer pool efficiency
- Performance recommendations

## Debugging Performance Issues

### Low FPS

1. Check shader pass timings to identify bottlenecks
2. Review GPU memory usage
3. Check for excessive texture uploads
4. Verify framebuffer pool efficiency
5. Consider reducing image resolution

### High Frame Time

1. Identify slowest shader pass
2. Check for redundant renders
3. Verify dirty flag optimization is working
4. Review texture upload frequency
5. Check for memory pressure

### Memory Issues

1. Monitor GPU memory usage over time
2. Check for texture leaks
3. Verify framebuffer cleanup
4. Review texture cache size
5. Check for growing memory usage

## Best Practices

1. **Enable profiling during development** to catch performance issues early
2. **Monitor production performance** with periodic profiling
3. **Set performance budgets** for each shader pass
4. **Test on various hardware** to ensure consistent performance
5. **Profile with realistic workloads** using actual user images
6. **Track performance over time** to detect regressions
7. **Use recommendations** to guide optimization efforts

## API Reference

### PerformanceProfiler Methods

- `startFrame()`: Begin timing a frame
- `endFrame(startTime)`: End timing a frame
- `startPass(name)`: Begin timing a shader pass
- `endPass(name, startTime, wasSkipped)`: End timing a shader pass
- `recordTextureUpload(bytes, duration, wasReused)`: Record texture upload
- `recordFramebufferPoolHit()`: Record framebuffer pool hit
- `recordFramebufferPoolMiss()`: Record framebuffer pool miss
- `updateGPUMemoryUsage(bytes)`: Update GPU memory estimate
- `getProfile()`: Get current performance profile
- `getRecommendations()`: Get performance recommendations
- `isPerformanceBelowTarget()`: Check if performance is below target
- `reset()`: Reset all statistics
- `exportProfile()`: Export profile as JSON

### ShaderPipeline Methods

- `getPerformanceProfile()`: Get comprehensive performance profile
- `getPerformanceRecommendations()`: Get optimization recommendations
- `exportPerformanceProfile()`: Export profile as JSON
- `resetPerformanceStats()`: Reset all performance statistics

## Requirements Satisfied

This implementation satisfies the following requirements:

- **Requirement 8.2**: Optimize texture uploads and framebuffer usage
- **Requirement 13.1**: Real-time rendering with requestAnimationFrame
- **Requirement 17**: Comprehensive performance profiling and optimization
  - Profile shader execution time ✓
  - Optimize texture uploads ✓
  - Reduce redundant renders ✓
  - Optimize framebuffer usage ✓
  - Ensure 60 FPS for preview ✓

## Future Enhancements

Potential improvements for the profiling system:

1. **GPU Query Timers**: Use WebGL timer queries for more accurate GPU timing
2. **Flame Graphs**: Visualize performance bottlenecks
3. **Historical Tracking**: Store performance data over time
4. **Automated Optimization**: Automatically adjust quality settings based on performance
5. **Performance Budgets**: Set and enforce performance budgets per pass
6. **A/B Testing**: Compare performance of different implementations
7. **Remote Monitoring**: Send performance data to analytics service
