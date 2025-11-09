/**
 * Render Scheduler
 * Manages real-time rendering optimizations including:
 * - requestAnimationFrame-based render loop
 * - Frame skipping for slow renders
 * - Batching multiple changes into single render
 * - Performance monitoring and FPS tracking
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

export interface RenderSchedulerConfig {
  targetFPS: number; // Target frame rate (default: 60)
  minFPS: number; // Minimum acceptable FPS before frame skipping (default: 30)
  batchDelay: number; // Delay in ms to batch multiple changes (default: 16ms)
  enableFrameSkipping: boolean; // Enable frame skipping for slow renders
  enablePerformanceMonitoring: boolean; // Track FPS and frame times
}

export interface PerformanceStats {
  currentFPS: number;
  averageFPS: number;
  lastFrameTime: number;
  averageFrameTime: number;
  droppedFrames: number;
  totalFrames: number;
  isLowPerformance: boolean; // True if FPS is below minFPS
}

type RenderCallback = () => void;

/**
 * RenderScheduler manages the render loop with optimizations
 * Requirement 13.1: requestAnimationFrame-based render loop
 * Requirement 13.2: Batch multiple slider changes into single render
 * Requirement 13.3: Frame skipping if rendering is slow
 * Requirement 13.4: Performance indicator for low FPS
 */
export class RenderScheduler {
  private config: RenderSchedulerConfig;
  private renderCallback: RenderCallback | null = null;
  private animationFrameId: number | null = null;
  private batchTimeoutId: number | null = null;

  // Render state
  private isRenderPending = false;
  private isRendering = false;
  private renderStartTime = 0;

  // Performance tracking
  private frameCount = 0;
  private droppedFrameCount = 0;
  private frameTimes: number[] = [];
  private fpsHistory: number[] = [];
  private lastFPSUpdateTime = 0;
  private currentFPS = 0;

  // Frame skipping
  private consecutiveSlowFrames = 0;
  private skipNextFrame = false;

  constructor(config: Partial<RenderSchedulerConfig> = {}) {
    this.config = {
      targetFPS: config.targetFPS ?? 60,
      minFPS: config.minFPS ?? 30,
      batchDelay: config.batchDelay ?? 16, // ~1 frame at 60fps
      enableFrameSkipping: config.enableFrameSkipping ?? true,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
    };
  }

  /**
   * Set the render callback function
   */
  public setRenderCallback(callback: RenderCallback): void {
    this.renderCallback = callback;
  }

  /**
   * Schedule a render with batching
   * Multiple calls within batchDelay will be batched into a single render
   * Requirement 13.2: Batch multiple slider changes into single render
   */
  public scheduleRender(): void {
    // If already rendering, mark as pending
    if (this.isRendering) {
      this.isRenderPending = true;
      return;
    }

    // Clear existing batch timeout
    if (this.batchTimeoutId !== null) {
      clearTimeout(this.batchTimeoutId);
    }

    // Batch multiple changes within the delay window
    this.batchTimeoutId = window.setTimeout(() => {
      this.batchTimeoutId = null;
      this.requestRender();
    }, this.config.batchDelay);
  }

  /**
   * Request an immediate render via requestAnimationFrame
   * Requirement 13.1: requestAnimationFrame-based render loop
   */
  private requestRender(): void {
    if (this.animationFrameId !== null) {
      return; // Already scheduled
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.executeRender();
    });
  }

  /**
   * Execute the render with performance monitoring and frame skipping
   * Requirement 13.3: Frame skipping if rendering is slow
   * Requirement 13.4: Performance indicator for low FPS
   */
  private executeRender(): void {
    if (!this.renderCallback) {
      return;
    }

    // Check if we should skip this frame due to slow rendering
    // Requirement 13.3: Skip frames if rendering takes longer than 33ms (30 FPS)
    if (this.skipNextFrame && this.config.enableFrameSkipping) {
      this.skipNextFrame = false;
      this.droppedFrameCount++;

      // If there's a pending render, schedule it
      if (this.isRenderPending) {
        this.isRenderPending = false;
        this.requestRender();
      }
      return;
    }

    // Mark as rendering
    this.isRendering = true;
    this.renderStartTime = performance.now();

    try {
      // Execute the render callback
      this.renderCallback();

      // Calculate frame time
      const frameTime = performance.now() - this.renderStartTime;

      // Update performance metrics
      if (this.config.enablePerformanceMonitoring) {
        this.updatePerformanceMetrics(frameTime);
      }

      // Check if frame was slow
      // Requirement 13.3: Implement frame skipping if rendering is slow
      const targetFrameTime = 1000 / this.config.targetFPS;
      const maxFrameTime = 1000 / this.config.minFPS; // 33ms for 30 FPS

      if (frameTime > maxFrameTime) {
        this.consecutiveSlowFrames++;

        // Skip next frame if we have multiple consecutive slow frames
        if (this.consecutiveSlowFrames >= 2 && this.config.enableFrameSkipping) {
          this.skipNextFrame = true;
        }
      } else if (frameTime < targetFrameTime) {
        // Reset slow frame counter if we're back to normal speed
        this.consecutiveSlowFrames = 0;
        this.skipNextFrame = false;
      }
    } catch (error) {
      console.error('Render error:', error);
    } finally {
      this.isRendering = false;

      // If there's a pending render, schedule it
      if (this.isRenderPending) {
        this.isRenderPending = false;
        this.requestRender();
      }
    }
  }

  /**
   * Update performance metrics
   * Requirement 13.4: Add performance indicator for low FPS
   */
  private updatePerformanceMetrics(frameTime: number): void {
    this.frameCount++;

    // Track frame times (keep last 60 frames)
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    // Calculate FPS every 500ms
    const now = performance.now();
    if (now - this.lastFPSUpdateTime >= 500) {
      const timeDelta = (now - this.lastFPSUpdateTime) / 1000;
      const framesSinceLastUpdate = this.frameCount;

      this.currentFPS = framesSinceLastUpdate / timeDelta;

      // Track FPS history (keep last 10 samples)
      this.fpsHistory.push(this.currentFPS);
      if (this.fpsHistory.length > 10) {
        this.fpsHistory.shift();
      }

      this.lastFPSUpdateTime = now;
      this.frameCount = 0;
    }
  }

  /**
   * Get current performance statistics
   * Requirement 13.4: Performance indicator for low FPS
   */
  public getPerformanceStats(): PerformanceStats {
    const averageFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    const averageFPS =
      this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
        : 0;

    const isLowPerformance = this.currentFPS < this.config.minFPS && this.currentFPS > 0;

    return {
      currentFPS: this.currentFPS,
      averageFPS,
      lastFrameTime: this.frameTimes[this.frameTimes.length - 1] ?? 0,
      averageFrameTime,
      droppedFrames: this.droppedFrameCount,
      totalFrames: this.frameCount + this.droppedFrameCount,
      isLowPerformance,
    };
  }

  /**
   * Check if performance is currently low
   * Requirement 13.4: Performance indicator for low FPS
   */
  public isLowPerformance(): boolean {
    return this.currentFPS < this.config.minFPS && this.currentFPS > 0;
  }

  /**
   * Get current FPS
   */
  public getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Reset performance statistics
   */
  public resetStats(): void {
    this.frameCount = 0;
    this.droppedFrameCount = 0;
    this.frameTimes = [];
    this.fpsHistory = [];
    this.currentFPS = 0;
    this.consecutiveSlowFrames = 0;
    this.skipNextFrame = false;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RenderSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable or disable frame skipping
   */
  public setFrameSkippingEnabled(enabled: boolean): void {
    this.config.enableFrameSkipping = enabled;
    if (!enabled) {
      this.skipNextFrame = false;
      this.consecutiveSlowFrames = 0;
    }
  }

  /**
   * Enable or disable performance monitoring
   */
  public setPerformanceMonitoringEnabled(enabled: boolean): void {
    this.config.enablePerformanceMonitoring = enabled;
    if (!enabled) {
      this.resetStats();
    }
  }

  /**
   * Cancel any pending renders
   */
  public cancelPendingRender(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.batchTimeoutId !== null) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }

    this.isRenderPending = false;
  }

  /**
   * Dispose the scheduler and clean up resources
   */
  public dispose(): void {
    this.cancelPendingRender();
    this.renderCallback = null;
    this.resetStats();
  }
}
