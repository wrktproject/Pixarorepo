# Task 11: Real-Time Rendering Optimizations - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interaction                         │
│                    (Slider adjustments, etc.)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Canvas Component                            │
│  - Handles user input                                            │
│  - Calls pipeline.render() on adjustment changes                 │
│  - Displays PerformanceIndicator                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ShaderPipeline                              │
│  - Public API: render(adjustments)                               │
│  - Delegates to RenderScheduler                                  │
│  - Tracks dirty flags for optimization                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RenderScheduler                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  scheduleRender()                                         │  │
│  │    ↓                                                      │  │
│  │  Batch Timer (16ms)                                      │  │
│  │    ↓                                                      │  │
│  │  requestAnimationFrame()                                 │  │
│  │    ↓                                                      │  │
│  │  executeRender()                                         │  │
│  │    ↓                                                      │  │
│  │  renderCallback() → ShaderPipeline.executeRender()      │  │
│  │    ↓                                                      │  │
│  │  Performance Tracking                                    │  │
│  │    ↓                                                      │  │
│  │  Frame Skipping Logic                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ShaderPipeline.executeRender()                  │
│  - Executes shader passes                                        │
│  - Updates performance metrics                                   │
│  - Renders to canvas                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Scenario 1: Single Adjustment
```
User adjusts slider
    ↓
Canvas.render()
    ↓
ShaderPipeline.render(adjustments)
    ↓
RenderScheduler.scheduleRender()
    ↓
[16ms batch delay]
    ↓
requestAnimationFrame()
    ↓
ShaderPipeline.executeRender()
    ↓
WebGL rendering
```

### Scenario 2: Multiple Rapid Adjustments (Batching)
```
User adjusts slider 1 (t=0ms)
    ↓
scheduleRender() → Batch timer starts

User adjusts slider 2 (t=5ms)
    ↓
scheduleRender() → Batch timer resets

User adjusts slider 3 (t=10ms)
    ↓
scheduleRender() → Batch timer resets

[16ms from last adjustment]
    ↓
requestAnimationFrame()
    ↓
Single render with final adjustments
```

### Scenario 3: Slow Rendering (Frame Skipping)
```
Frame 1: Render takes 50ms (slow)
    ↓
consecutiveSlowFrames = 1

Frame 2: Render takes 45ms (slow)
    ↓
consecutiveSlowFrames = 2
skipNextFrame = true

Frame 3: Skipped
    ↓
droppedFrames++

Frame 4: Render takes 15ms (fast)
    ↓
consecutiveSlowFrames = 0
skipNextFrame = false
```

## Performance Monitoring Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     RenderScheduler                              │
│                                                                   │
│  executeRender() {                                               │
│    startTime = performance.now()                                 │
│    ↓                                                              │
│    renderCallback()  // Actual rendering                         │
│    ↓                                                              │
│    frameTime = performance.now() - startTime                     │
│    ↓                                                              │
│    updatePerformanceMetrics(frameTime)                           │
│  }                                                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Performance Metrics                             │
│                                                                   │
│  - frameTimes[] (last 60 frames)                                │
│  - fpsHistory[] (last 10 samples)                               │
│  - currentFPS (updated every 500ms)                             │
│  - averageFPS                                                    │
│  - droppedFrames                                                 │
│  - isLowPerformance (FPS < minFPS)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Canvas Component                                │
│                                                                   │
│  useEffect(() => {                                               │
│    setInterval(() => {                                           │
│      stats = pipeline.getRenderSchedulerStats()                  │
│      setPerformanceStats(stats)                                  │
│    }, 500)                                                        │
│  })                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                PerformanceIndicator Component                    │
│                                                                   │
│  - Displays FPS (color-coded)                                   │
│  - Shows warning if isLowPerformance                            │
│  - Optional detailed stats view                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Separation of Concerns
- **RenderScheduler**: Handles timing, batching, and frame skipping
- **ShaderPipeline**: Handles WebGL rendering and shader management
- **Canvas**: Handles UI and user interaction
- **PerformanceIndicator**: Handles performance visualization

### 2. Batching Strategy
- **Delay**: 16ms (1 frame at 60 FPS)
- **Rationale**: Balances responsiveness with batching efficiency
- **Benefit**: Reduces render calls by ~60% during rapid adjustments

### 3. Frame Skipping Strategy
- **Trigger**: 2 consecutive slow frames (>33ms)
- **Rationale**: Avoids skipping on occasional slow frames
- **Recovery**: Automatic when performance improves

### 4. Performance Monitoring
- **Update frequency**: 500ms
- **Rationale**: Balances accuracy with overhead
- **Metrics**: FPS, frame time, dropped frames

## Configuration Options

```typescript
interface RenderSchedulerConfig {
  targetFPS: number;              // Default: 60
  minFPS: number;                 // Default: 30
  batchDelay: number;             // Default: 16ms
  enableFrameSkipping: boolean;   // Default: true
  enablePerformanceMonitoring: boolean; // Default: true
}
```

### Recommended Configurations

#### High-End Desktop
```typescript
{
  targetFPS: 60,
  minFPS: 45,
  batchDelay: 16,
  enableFrameSkipping: false,  // Not needed
}
```

#### Mid-Range Desktop
```typescript
{
  targetFPS: 60,
  minFPS: 30,
  batchDelay: 16,
  enableFrameSkipping: true,
}
```

#### Mobile/Low-End
```typescript
{
  targetFPS: 30,
  minFPS: 15,
  batchDelay: 32,  // More aggressive batching
  enableFrameSkipping: true,
}
```

## Performance Impact

### Before Optimization
```
10 slider adjustments in 100ms:
- 10 render calls
- 10 × 20ms = 200ms total render time
- UI feels sluggish
```

### After Optimization
```
10 slider adjustments in 100ms:
- 1 render call (batched)
- 1 × 20ms = 20ms total render time
- UI feels responsive
- 90% reduction in render time
```

### Frame Skipping Impact
```
Without frame skipping:
- Slow frame (50ms) → UI freezes
- User perceives lag

With frame skipping:
- Slow frame (50ms) → Next frame skipped
- UI remains responsive
- Slight visual delay acceptable
```

## Testing Strategy

### Unit Tests (20 tests)
1. **Batching**: Verify multiple calls are batched
2. **Frame skipping**: Verify frames are skipped when slow
3. **Performance tracking**: Verify metrics are accurate
4. **Configuration**: Verify config changes work
5. **Edge cases**: Verify error handling

### Integration Tests
1. **Canvas integration**: Verify UI updates correctly
2. **Pipeline integration**: Verify rendering works
3. **Performance indicator**: Verify display is accurate

### Manual Testing
1. **Rapid slider adjustments**: Should feel smooth
2. **Heavy processing**: Should remain responsive
3. **FPS indicator**: Should show accurate values
4. **Low performance warning**: Should appear when appropriate

## Future Enhancements

### Adaptive Quality
```typescript
if (scheduler.isLowPerformance()) {
  pipeline.setQualityMode('preview');  // Lower quality
  pipeline.setMaxPreviewSize(1024);    // Smaller size
}
```

### Render Prioritization
```typescript
if (scheduler.isLowPerformance()) {
  // Skip expensive passes
  pipeline.setPassEnabled('clarity', false);
  pipeline.setPassEnabled('detail', false);
}
```

### Progressive Rendering
```typescript
// Render at low quality first
pipeline.render(adjustments, { quality: 'low' });

// Then refine
setTimeout(() => {
  pipeline.render(adjustments, { quality: 'high' });
}, 100);
```
