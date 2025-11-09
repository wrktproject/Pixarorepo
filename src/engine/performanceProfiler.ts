/**
 * Performance Profiler
 * Comprehensive performance monitoring and profiling for the shader pipeline
 * Tracks shader execution time, texture uploads, render calls, and framebuffer usage
 * Requirements: 8.2, 13.1, 17
 */

export interface ProfilerConfig {
  enabled: boolean;
  sampleSize: number; // Number of samples to keep for averaging
  logInterval: number; // Interval in ms to log performance data
  enableDetailedProfiling: boolean; // Track individual pass timings
}

export interface ShaderPassProfile {
  name: string;
  executionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  callCount: number;
  skippedCount: number; // Times skipped due to dirty flag optimization
}

export interface TextureUploadProfile {
  count: number;
  totalBytes: number;
  totalTime: number;
  averageTime: number;
  reusedTextures: number; // Textures reused instead of recreated
}

export interface FramebufferProfile {
  poolHits: number; // Times framebuffer was reused from pool
  poolMisses: number; // Times new framebuffer was created
  activeFramebuffers: number;
  totalCreated: number;
  totalDeleted: number;
}

export interface RenderProfile {
  totalRenders: number;
  redundantRenders: number; // Renders that were batched/skipped
  averageFrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  currentFPS: number;
  targetFPS: number;
  droppedFrames: number;
}

export interface PerformanceProfile {
  timestamp: number;
  render: RenderProfile;
  shaderPasses: Map<string, ShaderPassProfile>;
  textureUploads: TextureUploadProfile;
  framebuffers: FramebufferProfile;
  gpuMemoryUsageMB: number;
  cpuMemoryUsageMB: number;
}

interface TimingSample {
  timestamp: number;
  duration: number;
}

/**
 * PerformanceProfiler provides comprehensive performance monitoring
 * for the shader pipeline with minimal overhead
 */
export class PerformanceProfiler {
  private config: ProfilerConfig;
  private enabled: boolean;

  // Render tracking
  private renderCount = 0;
  private redundantRenderCount = 0;
  private frameTimeSamples: TimingSample[] = [];
  private droppedFrameCount = 0;
  private targetFPS = 60;

  // Shader pass tracking
  private passProfiles: Map<string, ShaderPassProfile> = new Map();
  private passTimeSamples: Map<string, TimingSample[]> = new Map();

  // Texture upload tracking
  private textureUploadCount = 0;
  private textureUploadBytes = 0;
  private textureUploadTime = 0;
  private textureReuseCount = 0;
  private textureUploadSamples: TimingSample[] = [];

  // Framebuffer tracking
  private framebufferPoolHits = 0;
  private framebufferPoolMisses = 0;
  private framebufferCreatedCount = 0;
  private framebufferDeletedCount = 0;

  // GPU memory tracking
  private gpuMemoryUsageMB = 0;

  // Logging
  private logTimer: number | null = null;

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleSize: config.sampleSize ?? 60, // Keep last 60 samples (~1 second at 60fps)
      logInterval: config.logInterval ?? 5000, // Log every 5 seconds
      enableDetailedProfiling: config.enableDetailedProfiling ?? true,
    };

    this.enabled = this.config.enabled;

    if (this.enabled && this.config.logInterval > 0) {
      this.startAutoLogging();
    }
  }

  /**
   * Start automatic performance logging
   */
  private startAutoLogging(): void {
    if (typeof window !== 'undefined') {
      this.logTimer = window.setInterval(() => {
        this.logPerformanceData();
      }, this.config.logInterval);
    }
  }

  /**
   * Log performance data to console
   */
  private logPerformanceData(): void {
    if (!this.enabled) return;

    const profile = this.getProfile();
    const render = profile.render;

    console.group('🎯 Performance Profile');
    console.log(`FPS: ${render.currentFPS.toFixed(1)} (target: ${render.targetFPS})`);
    console.log(
      `Frame Time: ${render.averageFrameTime.toFixed(2)}ms (min: ${render.minFrameTime.toFixed(2)}ms, max: ${render.maxFrameTime.toFixed(2)}ms)`
    );
    console.log(
      `Renders: ${render.totalRenders} (redundant: ${render.redundantRenders}, dropped: ${render.droppedFrames})`
    );
    console.log(`GPU Memory: ${profile.gpuMemoryUsageMB.toFixed(2)}MB`);

    if (this.config.enableDetailedProfiling && profile.shaderPasses.size > 0) {
      console.group('Shader Passes');
      profile.shaderPasses.forEach((pass) => {
        console.log(
          `  ${pass.name}: ${pass.averageExecutionTime.toFixed(2)}ms avg (${pass.callCount} calls, ${pass.skippedCount} skipped)`
        );
      });
      console.groupEnd();
    }

    console.log(
      `Texture Uploads: ${profile.textureUploads.count} (${(profile.textureUploads.totalBytes / (1024 * 1024)).toFixed(2)}MB, ${profile.textureUploads.reusedTextures} reused)`
    );
    console.log(
      `Framebuffers: ${profile.framebuffers.poolHits} hits / ${profile.framebuffers.poolMisses} misses (${profile.framebuffers.activeFramebuffers} active)`
    );
    console.groupEnd();
  }

  /**
   * Enable or disable profiling
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.config.enabled = enabled;

    if (enabled && this.config.logInterval > 0 && !this.logTimer) {
      this.startAutoLogging();
    } else if (!enabled && this.logTimer) {
      window.clearInterval(this.logTimer);
      this.logTimer = null;
    }
  }

  /**
   * Set target FPS for performance calculations
   */
  public setTargetFPS(fps: number): void {
    this.targetFPS = fps;
  }

  /**
   * Start timing a render frame
   */
  public startFrame(): number {
    if (!this.enabled) return 0;
    return performance.now();
  }

  /**
   * End timing a render frame
   */
  public endFrame(startTime: number): void {
    if (!this.enabled || startTime === 0) return;

    const duration = performance.now() - startTime;
    this.renderCount++;

    // Add to samples
    this.frameTimeSamples.push({ timestamp: Date.now(), duration });

    // Keep only recent samples
    if (this.frameTimeSamples.length > this.config.sampleSize) {
      this.frameTimeSamples.shift();
    }
  }

  /**
   * Record a redundant render that was batched or skipped
   */
  public recordRedundantRender(): void {
    if (!this.enabled) return;
    this.redundantRenderCount++;
  }

  /**
   * Record a dropped frame
   */
  public recordDroppedFrame(): void {
    if (!this.enabled) return;
    this.droppedFrameCount++;
  }

  /**
   * Start timing a shader pass
   */
  public startPass(passName: string): number {
    if (!this.enabled || !this.config.enableDetailedProfiling) return 0;
    return performance.now();
  }

  /**
   * End timing a shader pass
   */
  public endPass(passName: string, startTime: number, wasSkipped: boolean = false): void {
    if (!this.enabled || !this.config.enableDetailedProfiling || startTime === 0) return;

    const duration = performance.now() - startTime;

    // Get or create pass profile
    let profile = this.passProfiles.get(passName);
    if (!profile) {
      profile = {
        name: passName,
        executionTime: 0,
        averageExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        callCount: 0,
        skippedCount: 0,
      };
      this.passProfiles.set(passName, profile);
      this.passTimeSamples.set(passName, []);
    }

    if (wasSkipped) {
      profile.skippedCount++;
    } else {
      profile.executionTime = duration;
      profile.callCount++;
      profile.minExecutionTime = Math.min(profile.minExecutionTime, duration);
      profile.maxExecutionTime = Math.max(profile.maxExecutionTime, duration);

      // Add to samples
      const samples = this.passTimeSamples.get(passName)!;
      samples.push({ timestamp: Date.now(), duration });

      // Keep only recent samples
      if (samples.length > this.config.sampleSize) {
        samples.shift();
      }

      // Calculate average
      const sum = samples.reduce((acc, s) => acc + s.duration, 0);
      profile.averageExecutionTime = sum / samples.length;
    }
  }

  /**
   * Record a texture upload
   */
  public recordTextureUpload(bytes: number, duration: number, wasReused: boolean = false): void {
    if (!this.enabled) return;

    this.textureUploadCount++;
    this.textureUploadBytes += bytes;
    this.textureUploadTime += duration;

    if (wasReused) {
      this.textureReuseCount++;
    }

    // Add to samples
    this.textureUploadSamples.push({ timestamp: Date.now(), duration });

    // Keep only recent samples
    if (this.textureUploadSamples.length > this.config.sampleSize) {
      this.textureUploadSamples.shift();
    }
  }

  /**
   * Record framebuffer pool hit (reused from pool)
   */
  public recordFramebufferPoolHit(): void {
    if (!this.enabled) return;
    this.framebufferPoolHits++;
  }

  /**
   * Record framebuffer pool miss (new framebuffer created)
   */
  public recordFramebufferPoolMiss(): void {
    if (!this.enabled) return;
    this.framebufferPoolMisses++;
  }

  /**
   * Record framebuffer creation
   */
  public recordFramebufferCreated(): void {
    if (!this.enabled) return;
    this.framebufferCreatedCount++;
  }

  /**
   * Record framebuffer deletion
   */
  public recordFramebufferDeleted(): void {
    if (!this.enabled) return;
    this.framebufferDeletedCount++;
  }

  /**
   * Update GPU memory usage
   */
  public updateGPUMemoryUsage(bytes: number): void {
    if (!this.enabled) return;
    this.gpuMemoryUsageMB = bytes / (1024 * 1024);
  }

  /**
   * Get current performance profile
   */
  public getProfile(): PerformanceProfile {
    // Calculate render stats
    const frameTimeSum = this.frameTimeSamples.reduce((acc, s) => acc + s.duration, 0);
    const averageFrameTime =
      this.frameTimeSamples.length > 0 ? frameTimeSum / this.frameTimeSamples.length : 0;
    const minFrameTime =
      this.frameTimeSamples.length > 0
        ? Math.min(...this.frameTimeSamples.map((s) => s.duration))
        : 0;
    const maxFrameTime =
      this.frameTimeSamples.length > 0
        ? Math.max(...this.frameTimeSamples.map((s) => s.duration))
        : 0;
    const currentFPS = averageFrameTime > 0 ? 1000 / averageFrameTime : 0;

    // Calculate texture upload stats
    const textureUploadTimeSum = this.textureUploadSamples.reduce(
      (acc, s) => acc + s.duration,
      0
    );
    const averageTextureUploadTime =
      this.textureUploadSamples.length > 0
        ? textureUploadTimeSum / this.textureUploadSamples.length
        : 0;

    // Get CPU memory usage (if available)
    let cpuMemoryUsageMB = 0;
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      cpuMemoryUsageMB = memory.usedJSHeapSize / (1024 * 1024);
    }

    return {
      timestamp: Date.now(),
      render: {
        totalRenders: this.renderCount,
        redundantRenders: this.redundantRenderCount,
        averageFrameTime,
        minFrameTime,
        maxFrameTime,
        currentFPS,
        targetFPS: this.targetFPS,
        droppedFrames: this.droppedFrameCount,
      },
      shaderPasses: new Map(this.passProfiles),
      textureUploads: {
        count: this.textureUploadCount,
        totalBytes: this.textureUploadBytes,
        totalTime: this.textureUploadTime,
        averageTime: averageTextureUploadTime,
        reusedTextures: this.textureReuseCount,
      },
      framebuffers: {
        poolHits: this.framebufferPoolHits,
        poolMisses: this.framebufferPoolMisses,
        activeFramebuffers: this.framebufferCreatedCount - this.framebufferDeletedCount,
        totalCreated: this.framebufferCreatedCount,
        totalDeleted: this.framebufferDeletedCount,
      },
      gpuMemoryUsageMB: this.gpuMemoryUsageMB,
      cpuMemoryUsageMB,
    };
  }

  /**
   * Get shader pass profiles
   */
  public getShaderPassProfiles(): Map<string, ShaderPassProfile> {
    return new Map(this.passProfiles);
  }

  /**
   * Get render statistics
   */
  public getRenderStats(): RenderProfile {
    return this.getProfile().render;
  }

  /**
   * Check if performance is below target
   */
  public isPerformanceBelowTarget(): boolean {
    const profile = this.getProfile();
    return profile.render.currentFPS < this.targetFPS * 0.9; // 90% of target
  }

  /**
   * Get performance recommendations
   */
  public getRecommendations(): string[] {
    const recommendations: string[] = [];
    const profile = this.getProfile();

    // Check FPS
    if (profile.render.currentFPS < this.targetFPS * 0.5) {
      recommendations.push('FPS is critically low. Consider reducing image resolution or disabling effects.');
    } else if (profile.render.currentFPS < this.targetFPS * 0.9) {
      recommendations.push('FPS is below target. Consider enabling frame skipping or reducing quality.');
    }

    // Check redundant renders
    const redundantRatio = profile.render.redundantRenders / profile.render.totalRenders;
    if (redundantRatio > 0.3) {
      recommendations.push(
        `High redundant render ratio (${(redundantRatio * 100).toFixed(1)}%). Render batching is working well.`
      );
    }

    // Check framebuffer pool efficiency
    const poolTotal = profile.framebuffers.poolHits + profile.framebuffers.poolMisses;
    if (poolTotal > 0) {
      const poolHitRatio = profile.framebuffers.poolHits / poolTotal;
      if (poolHitRatio < 0.5) {
        recommendations.push(
          `Low framebuffer pool hit ratio (${(poolHitRatio * 100).toFixed(1)}%). Consider increasing pool size.`
        );
      }
    }

    // Check texture reuse
    if (profile.textureUploads.count > 0) {
      const reuseRatio = profile.textureUploads.reusedTextures / profile.textureUploads.count;
      if (reuseRatio < 0.5) {
        recommendations.push(
          `Low texture reuse ratio (${(reuseRatio * 100).toFixed(1)}%). Textures are being recreated frequently.`
        );
      }
    }

    // Check GPU memory
    if (profile.gpuMemoryUsageMB > 512) {
      recommendations.push(
        `High GPU memory usage (${profile.gpuMemoryUsageMB.toFixed(2)}MB). Consider reducing texture sizes.`
      );
    }

    // Check slowest shader passes
    if (this.config.enableDetailedProfiling) {
      const sortedPasses = Array.from(profile.shaderPasses.values()).sort(
        (a, b) => b.averageExecutionTime - a.averageExecutionTime
      );

      if (sortedPasses.length > 0 && sortedPasses[0].averageExecutionTime > 10) {
        recommendations.push(
          `Slowest shader pass: ${sortedPasses[0].name} (${sortedPasses[0].averageExecutionTime.toFixed(2)}ms avg)`
        );
      }
    }

    return recommendations;
  }

  /**
   * Reset all statistics
   */
  public reset(): void {
    this.renderCount = 0;
    this.redundantRenderCount = 0;
    this.frameTimeSamples = [];
    this.droppedFrameCount = 0;
    this.passProfiles.clear();
    this.passTimeSamples.clear();
    this.textureUploadCount = 0;
    this.textureUploadBytes = 0;
    this.textureUploadTime = 0;
    this.textureReuseCount = 0;
    this.textureUploadSamples = [];
    this.framebufferPoolHits = 0;
    this.framebufferPoolMisses = 0;
    this.framebufferCreatedCount = 0;
    this.framebufferDeletedCount = 0;
    this.gpuMemoryUsageMB = 0;
  }

  /**
   * Export profile data as JSON
   */
  public exportProfile(): string {
    const profile = this.getProfile();
    return JSON.stringify(
      {
        ...profile,
        shaderPasses: Array.from(profile.shaderPasses.entries()),
      },
      null,
      2
    );
  }

  /**
   * Dispose profiler and clean up resources
   */
  public dispose(): void {
    if (this.logTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.logTimer);
      this.logTimer = null;
    }
    this.reset();
  }
}
