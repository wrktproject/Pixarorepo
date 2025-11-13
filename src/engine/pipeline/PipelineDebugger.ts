/**
 * Pipeline Debugger
 * Visualization and profiling tools for debugging the shader pipeline
 * Provides intermediate stage visualization, performance profiling, and texture inspection
 */

export interface PassTiming {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  gpuTime?: number;
}

export interface FrameProfile {
  frameNumber: number;
  timestamp: number;
  totalDuration: number;
  passes: PassTiming[];
  textureUploads: number;
  drawCalls: number;
}

export interface PipelineDebugConfig {
  enableProfiling?: boolean;
  enableVisualization?: boolean;
  captureIntermediates?: boolean;
  maxFrameHistory?: number;
}

/**
 * PipelineDebugger provides debugging and profiling tools for the shader pipeline
 */
export class PipelineDebugger {
  private gl: WebGL2RenderingContext;
  private config: Required<PipelineDebugConfig>;

  // Profiling data
  private frameHistory: FrameProfile[] = [];
  private currentFrame: Partial<FrameProfile> | null = null;
  private frameNumber = 0;

  // GPU timing extension
  private timerExt: any = null;
  private timerQueries: Map<string, WebGLQuery> = new Map();

  // Intermediate textures for visualization
  private intermediateTextures: Map<string, WebGLTexture> = new Map();
  private intermediateData: Map<string, ImageData> = new Map();

  // Performance counters
  private counters = {
    textureUploads: 0,
    drawCalls: 0,
  };

  constructor(gl: WebGL2RenderingContext, config: PipelineDebugConfig = {}) {
    this.gl = gl;
    this.config = {
      enableProfiling: config.enableProfiling ?? true,
      enableVisualization: config.enableVisualization ?? false,
      captureIntermediates: config.captureIntermediates ?? false,
      maxFrameHistory: config.maxFrameHistory ?? 60,
    };

    // Try to get GPU timing extension
    if (this.config.enableProfiling) {
      this.initializeGPUTiming();
    }
  }

  /**
   * Initialize GPU timing extension
   */
  private initializeGPUTiming(): void {
    try {
      this.timerExt = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (this.timerExt) {
        console.log('GPU timing extension available');
      } else {
        console.warn('GPU timing extension not available');
      }
    } catch (e) {
      console.warn('Failed to initialize GPU timing:', e);
    }
  }

  /**
   * Start profiling a new frame
   */
  public startFrame(): number {
    if (!this.config.enableProfiling) {
      return 0;
    }

    const timestamp = performance.now();
    this.frameNumber++;

    this.currentFrame = {
      frameNumber: this.frameNumber,
      timestamp,
      passes: [],
      textureUploads: this.counters.textureUploads,
      drawCalls: this.counters.drawCalls,
    };

    // Reset counters
    this.counters.textureUploads = 0;
    this.counters.drawCalls = 0;

    return timestamp;
  }

  /**
   * Start profiling a pass
   */
  public startPass(passName: string): number {
    if (!this.config.enableProfiling || !this.currentFrame) {
      return 0;
    }

    const startTime = performance.now();

    // Start GPU timer if available
    if (this.timerExt) {
      const query = this.gl.createQuery();
      if (query) {
        this.gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, query);
        this.timerQueries.set(passName, query);
      }
    }

    return startTime;
  }

  /**
   * End profiling a pass
   */
  public endPass(passName: string, startTime: number): void {
    if (!this.config.enableProfiling || !this.currentFrame) {
      return;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // End GPU timer if available
    let gpuTime: number | undefined;
    if (this.timerExt) {
      this.gl.endQuery(this.timerExt.TIME_ELAPSED_EXT);

      // Try to get GPU time from previous query
      const query = this.timerQueries.get(passName);
      if (query) {
        const available = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
        if (available) {
          const timeNs = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
          gpuTime = timeNs / 1000000; // Convert nanoseconds to milliseconds
          this.gl.deleteQuery(query);
          this.timerQueries.delete(passName);
        }
      }
    }

    const passTiming: PassTiming = {
      name: passName,
      startTime,
      endTime,
      duration,
      gpuTime,
    };

    this.currentFrame.passes!.push(passTiming);
  }

  /**
   * End profiling the current frame
   */
  public endFrame(frameStartTime: number): void {
    if (!this.config.enableProfiling || !this.currentFrame) {
      return;
    }

    const totalDuration = performance.now() - frameStartTime;

    const frameProfile: FrameProfile = {
      frameNumber: this.currentFrame.frameNumber!,
      timestamp: this.currentFrame.timestamp!,
      totalDuration,
      passes: this.currentFrame.passes!,
      textureUploads: this.currentFrame.textureUploads!,
      drawCalls: this.currentFrame.drawCalls!,
    };

    // Add to history
    this.frameHistory.push(frameProfile);

    // Limit history size
    if (this.frameHistory.length > this.config.maxFrameHistory) {
      this.frameHistory.shift();
    }

    this.currentFrame = null;
  }

  /**
   * Record a texture upload
   */
  public recordTextureUpload(): void {
    this.counters.textureUploads++;
  }

  /**
   * Record a draw call
   */
  public recordDrawCall(): void {
    this.counters.drawCalls++;
  }

  /**
   * Capture an intermediate texture for visualization
   */
  public captureIntermediate(name: string, texture: WebGLTexture, width: number, height: number): void {
    if (!this.config.captureIntermediates) {
      return;
    }

    // Store texture reference
    this.intermediateTextures.set(name, texture);

    // Read texture data
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      return;
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );

    const pixels = new Uint8ClampedArray(width * height * 4);
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.deleteFramebuffer(framebuffer);

    // Store as ImageData
    const imageData = new ImageData(pixels, width, height);
    this.intermediateData.set(name, imageData);
  }

  /**
   * Get captured intermediate texture data
   */
  public getIntermediate(name: string): ImageData | undefined {
    return this.intermediateData.get(name);
  }

  /**
   * Get all captured intermediate names
   */
  public getIntermediateNames(): string[] {
    return Array.from(this.intermediateData.keys());
  }

  /**
   * Clear captured intermediates
   */
  public clearIntermediates(): void {
    this.intermediateTextures.clear();
    this.intermediateData.clear();
  }

  /**
   * Get frame history
   */
  public getFrameHistory(): FrameProfile[] {
    return [...this.frameHistory];
  }

  /**
   * Get latest frame profile
   */
  public getLatestFrame(): FrameProfile | undefined {
    return this.frameHistory[this.frameHistory.length - 1];
  }

  /**
   * Get average frame time over history
   */
  public getAverageFrameTime(): number {
    if (this.frameHistory.length === 0) {
      return 0;
    }

    const sum = this.frameHistory.reduce((acc, frame) => acc + frame.totalDuration, 0);
    return sum / this.frameHistory.length;
  }

  /**
   * Get average FPS over history
   */
  public getAverageFPS(): number {
    const avgFrameTime = this.getAverageFrameTime();
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
  }

  /**
   * Get pass statistics
   */
  public getPassStats(): Map<string, { avgDuration: number; avgGPUTime?: number; count: number }> {
    const stats = new Map<string, { totalDuration: number; totalGPUTime: number; count: number }>();

    for (const frame of this.frameHistory) {
      for (const pass of frame.passes) {
        const existing = stats.get(pass.name) || { totalDuration: 0, totalGPUTime: 0, count: 0 };
        existing.totalDuration += pass.duration;
        if (pass.gpuTime !== undefined) {
          existing.totalGPUTime += pass.gpuTime;
        }
        existing.count++;
        stats.set(pass.name, existing);
      }
    }

    const result = new Map<string, { avgDuration: number; avgGPUTime?: number; count: number }>();
    for (const [name, data] of stats.entries()) {
      result.set(name, {
        avgDuration: data.totalDuration / data.count,
        avgGPUTime: data.totalGPUTime > 0 ? data.totalGPUTime / data.count : undefined,
        count: data.count,
      });
    }

    return result;
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    avgFPS: number;
    avgFrameTime: number;
    avgTextureUploads: number;
    avgDrawCalls: number;
    slowestPass: { name: string; avgDuration: number } | null;
  } {
    const avgFPS = this.getAverageFPS();
    const avgFrameTime = this.getAverageFrameTime();

    const avgTextureUploads =
      this.frameHistory.length > 0
        ? this.frameHistory.reduce((acc, f) => acc + f.textureUploads, 0) / this.frameHistory.length
        : 0;

    const avgDrawCalls =
      this.frameHistory.length > 0
        ? this.frameHistory.reduce((acc, f) => acc + f.drawCalls, 0) / this.frameHistory.length
        : 0;

    const passStats = this.getPassStats();
    let slowestPass: { name: string; avgDuration: number } | null = null;

    for (const [name, stats] of passStats.entries()) {
      if (!slowestPass || stats.avgDuration > slowestPass.avgDuration) {
        slowestPass = { name, avgDuration: stats.avgDuration };
      }
    }

    return {
      avgFPS,
      avgFrameTime,
      avgTextureUploads,
      avgDrawCalls,
      slowestPass,
    };
  }

  /**
   * Export profiling data as JSON
   */
  public exportProfilingData(): string {
    const data = {
      frameHistory: this.frameHistory,
      passStats: Array.from(this.getPassStats().entries()).map(([name, stats]) => ({
        name,
        ...stats,
      })),
      summary: this.getPerformanceSummary(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate performance report
   */
  public generateReport(): string {
    const summary = this.getPerformanceSummary();
    const passStats = this.getPassStats();

    let report = '='.repeat(80) + '\n';
    report += 'PIPELINE PERFORMANCE REPORT\n';
    report += '='.repeat(80) + '\n\n';

    report += `Average FPS: ${summary.avgFPS.toFixed(2)}\n`;
    report += `Average Frame Time: ${summary.avgFrameTime.toFixed(2)}ms\n`;
    report += `Average Texture Uploads: ${summary.avgTextureUploads.toFixed(1)}\n`;
    report += `Average Draw Calls: ${summary.avgDrawCalls.toFixed(1)}\n\n`;

    if (summary.slowestPass) {
      report += `Slowest Pass: ${summary.slowestPass.name} (${summary.slowestPass.avgDuration.toFixed(2)}ms)\n\n`;
    }

    report += 'Pass Statistics:\n';
    report += '-'.repeat(80) + '\n';

    const sortedPasses = Array.from(passStats.entries()).sort(
      (a, b) => b[1].avgDuration - a[1].avgDuration
    );

    for (const [name, stats] of sortedPasses) {
      report += `  ${name.padEnd(20)} ${stats.avgDuration.toFixed(2)}ms`;
      if (stats.avgGPUTime !== undefined) {
        report += ` (GPU: ${stats.avgGPUTime.toFixed(2)}ms)`;
      }
      report += `  [${stats.count} samples]\n`;
    }

    report += '='.repeat(80) + '\n';

    return report;
  }

  /**
   * Clear profiling history
   */
  public clearHistory(): void {
    this.frameHistory = [];
    this.frameNumber = 0;
  }

  /**
   * Enable or disable profiling
   */
  public setProfilingEnabled(enabled: boolean): void {
    this.config.enableProfiling = enabled;
    if (!enabled) {
      this.clearHistory();
    }
  }

  /**
   * Enable or disable intermediate capture
   */
  public setCaptureIntermediates(enabled: boolean): void {
    this.config.captureIntermediates = enabled;
    if (!enabled) {
      this.clearIntermediates();
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Delete any remaining timer queries
    for (const query of this.timerQueries.values()) {
      this.gl.deleteQuery(query);
    }
    this.timerQueries.clear();

    // Clear all data
    this.clearHistory();
    this.clearIntermediates();
  }
}
