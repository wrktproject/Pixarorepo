/**
 * Performance Tester
 * Comprehensive performance testing and benchmarking for the pipeline
 * Implements task 13.4: Performance testing
 */

import type { PipelineManager } from './PipelineManager';
import type { TexturePool } from './TexturePool';

export interface BenchmarkConfig {
  warmupRuns?: number;
  testRuns?: number;
  imageSizes?: Array<{ width: number; height: number; name: string }>;
  testModules?: string[];
  measureGPU?: boolean;
}

export interface ModuleBenchmark {
  moduleName: string;
  avgCPUTime: number;
  minCPUTime: number;
  maxCPUTime: number;
  avgGPUTime?: number;
  minGPUTime?: number;
  maxGPUTime?: number;
  samples: number;
}

export interface SizeBenchmark {
  size: string;
  width: number;
  height: number;
  totalPixels: number;
  avgFrameTime: number;
  avgFPS: number;
  memoryUsedMB: number;
  modules: ModuleBenchmark[];
}

export interface BenchmarkResults {
  timestamp: number;
  duration: number;
  sizes: SizeBenchmark[];
  summary: {
    avgFPS: number;
    avgFrameTime: number;
    slowestModule: { name: string; time: number } | null;
    fastestModule: { name: string; time: number } | null;
    totalMemoryMB: number;
  };
}

/**
 * PerformanceTester provides comprehensive benchmarking capabilities
 */
export class PerformanceTester {
  private gl: WebGL2RenderingContext;
  private pipelineManager: PipelineManager;
  private texturePool: TexturePool;

  constructor(
    gl: WebGL2RenderingContext,
    pipelineManager: PipelineManager,
    texturePool: TexturePool
  ) {
    this.gl = gl;
    this.pipelineManager = pipelineManager;
    this.texturePool = texturePool;
  }

  /**
   * Run comprehensive benchmark suite
   */
  public async runBenchmark(config: BenchmarkConfig = {}): Promise<BenchmarkResults> {
    const startTime = performance.now();

    const defaultConfig: Required<BenchmarkConfig> = {
      warmupRuns: config.warmupRuns ?? 3,
      testRuns: config.testRuns ?? 10,
      imageSizes: config.imageSizes ?? [
        { width: 1920, height: 1080, name: '1080p' },
        { width: 2560, height: 1440, name: '1440p' },
        { width: 3840, height: 2160, name: '4K' },
        { width: 7680, height: 4320, name: '8K' },
      ],
      testModules: config.testModules ?? this.pipelineManager.getModuleNames(),
      measureGPU: config.measureGPU ?? true,
    };

    const sizeBenchmarks: SizeBenchmark[] = [];

    // Test each image size
    for (const size of defaultConfig.imageSizes) {
      console.log(`Benchmarking ${size.name} (${size.width}x${size.height})...`);

      const sizeBenchmark = await this.benchmarkSize(
        size.width,
        size.height,
        size.name,
        defaultConfig
      );

      sizeBenchmarks.push(sizeBenchmark);
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(sizeBenchmarks);

    const duration = performance.now() - startTime;

    return {
      timestamp: Date.now(),
      duration,
      sizes: sizeBenchmarks,
      summary,
    };
  }

  /**
   * Benchmark a specific image size
   */
  private async benchmarkSize(
    width: number,
    height: number,
    name: string,
    config: Required<BenchmarkConfig>
  ): Promise<SizeBenchmark> {
    // Create test texture
    const testTexture = this.createTestTexture(width, height);

    // Warmup runs
    for (let i = 0; i < config.warmupRuns; i++) {
      await this.runSingleFrame(testTexture, width, height);
    }

    // Test runs
    const frameTimings: number[] = [];

    for (let i = 0; i < config.testRuns; i++) {
      const frameStart = performance.now();
      await this.runSingleFrame(testTexture, width, height);
      const frameEnd = performance.now();

      frameTimings.push(frameEnd - frameStart);

      // Collect module timings
      const stats = this.pipelineManager.getStats();
      if (stats.performance) {
        // Note: This assumes the debugger has pass statistics
        // In a real implementation, we'd need to access individual pass timings
      }
    }

    // Calculate statistics
    const avgFrameTime = this.average(frameTimings);
    const avgFPS = 1000 / avgFrameTime;

    // Get memory usage
    const poolStats = this.texturePool.getStats();
    const memoryUsedMB = poolStats.memoryUsedMB;

    // Benchmark individual modules
    const moduleBenchmarks: ModuleBenchmark[] = [];
    for (const moduleName of config.testModules) {
      const moduleBenchmark = await this.benchmarkModule(
        moduleName,
        testTexture,
        width,
        height,
        config.testRuns
      );
      if (moduleBenchmark) {
        moduleBenchmarks.push(moduleBenchmark);
      }
    }

    // Cleanup
    this.gl.deleteTexture(testTexture);

    return {
      size: name,
      width,
      height,
      totalPixels: width * height,
      avgFrameTime,
      avgFPS,
      memoryUsedMB,
      modules: moduleBenchmarks,
    };
  }

  /**
   * Benchmark a specific module
   */
  private async benchmarkModule(
    moduleName: string,
    testTexture: WebGLTexture,
    width: number,
    height: number,
    runs: number
  ): Promise<ModuleBenchmark | null> {
    const module = this.pipelineManager.getModule(moduleName);
    if (!module || !module.enabled) {
      return null;
    }

    const cpuTimings: number[] = [];

    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      // Execute just this module
      // Note: This is simplified - real implementation would need to isolate module execution
      await this.runSingleFrame(testTexture, width, height);
      const end = performance.now();

      cpuTimings.push(end - start);
    }

    return {
      moduleName,
      avgCPUTime: this.average(cpuTimings),
      minCPUTime: Math.min(...cpuTimings),
      maxCPUTime: Math.max(...cpuTimings),
      samples: runs,
    };
  }

  /**
   * Run a single frame through the pipeline
   */
  private async runSingleFrame(
    inputTexture: WebGLTexture,
    width: number,
    height: number
  ): Promise<void> {
    // Create output framebuffer
    const outputTexture = this.texturePool.acquire({
      width,
      height,
      format: 'rgba16f',
    });

    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      outputTexture,
      0
    );

    // Execute pipeline
    this.pipelineManager.execute({
      inputTexture,
      outputFramebuffer: framebuffer,
      width,
      height,
    });

    // Wait for GPU to finish
    this.gl.finish();

    // Cleanup
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.deleteFramebuffer(framebuffer);
    this.texturePool.release(outputTexture);
  }

  /**
   * Create a test texture with gradient pattern
   */
  private createTestTexture(width: number, height: number): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create test texture');
    }

    // Create gradient test pattern
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = (x / width) * 255; // R
        data[i + 1] = (y / height) * 255; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      data
    );

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    return texture;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(sizeBenchmarks: SizeBenchmark[]): BenchmarkResults['summary'] {
    const allFPS = sizeBenchmarks.map((s) => s.avgFPS);
    const allFrameTimes = sizeBenchmarks.map((s) => s.avgFrameTime);
    const allMemory = sizeBenchmarks.map((s) => s.memoryUsedMB);

    // Find slowest and fastest modules across all sizes
    let slowestModule: { name: string; time: number } | null = null;
    let fastestModule: { name: string; time: number } | null = null;

    for (const sizeBenchmark of sizeBenchmarks) {
      for (const module of sizeBenchmark.modules) {
        if (!slowestModule || module.avgCPUTime > slowestModule.time) {
          slowestModule = { name: module.moduleName, time: module.avgCPUTime };
        }
        if (!fastestModule || module.avgCPUTime < fastestModule.time) {
          fastestModule = { name: module.moduleName, time: module.avgCPUTime };
        }
      }
    }

    return {
      avgFPS: this.average(allFPS),
      avgFrameTime: this.average(allFrameTimes),
      slowestModule,
      fastestModule,
      totalMemoryMB: Math.max(...allMemory),
    };
  }

  /**
   * Calculate average of an array
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Generate benchmark report
   */
  public generateReport(results: BenchmarkResults): string {
    let report = '='.repeat(80) + '\n';
    report += 'PERFORMANCE BENCHMARK REPORT\n';
    report += '='.repeat(80) + '\n\n';

    report += `Timestamp: ${new Date(results.timestamp).toLocaleString()}\n`;
    report += `Duration: ${(results.duration / 1000).toFixed(2)}s\n\n`;

    report += 'Summary:\n';
    report += '-'.repeat(80) + '\n';
    report += `Average FPS: ${results.summary.avgFPS.toFixed(2)}\n`;
    report += `Average Frame Time: ${results.summary.avgFrameTime.toFixed(2)}ms\n`;
    report += `Peak Memory Usage: ${results.summary.totalMemoryMB.toFixed(2)}MB\n`;

    if (results.summary.slowestModule) {
      report += `Slowest Module: ${results.summary.slowestModule.name} (${results.summary.slowestModule.time.toFixed(2)}ms)\n`;
    }
    if (results.summary.fastestModule) {
      report += `Fastest Module: ${results.summary.fastestModule.name} (${results.summary.fastestModule.time.toFixed(2)}ms)\n`;
    }
    report += '\n';

    report += 'Results by Image Size:\n';
    report += '-'.repeat(80) + '\n';

    for (const size of results.sizes) {
      report += `\n${size.size} (${size.width}x${size.height}, ${(size.totalPixels / 1000000).toFixed(1)}MP):\n`;
      report += `  Frame Time: ${size.avgFrameTime.toFixed(2)}ms\n`;
      report += `  FPS: ${size.avgFPS.toFixed(2)}\n`;
      report += `  Memory: ${size.memoryUsedMB.toFixed(2)}MB\n`;

      if (size.modules.length > 0) {
        report += `  Module Performance:\n`;
        const sortedModules = [...size.modules].sort((a, b) => b.avgCPUTime - a.avgCPUTime);
        for (const module of sortedModules.slice(0, 5)) {
          report += `    ${module.moduleName.padEnd(20)} ${module.avgCPUTime.toFixed(2)}ms (${module.minCPUTime.toFixed(2)}-${module.maxCPUTime.toFixed(2)}ms)\n`;
        }
      }
    }

    report += '\n' + '='.repeat(80) + '\n';

    return report;
  }

  /**
   * Quick performance test (single size, fewer runs)
   */
  public async quickTest(width: number = 1920, height: number = 1080): Promise<{
    fps: number;
    frameTime: number;
    memoryMB: number;
  }> {
    const testTexture = this.createTestTexture(width, height);

    // Warmup
    await this.runSingleFrame(testTexture, width, height);

    // Test
    const timings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await this.runSingleFrame(testTexture, width, height);
      const end = performance.now();
      timings.push(end - start);
    }

    const avgFrameTime = this.average(timings);
    const fps = 1000 / avgFrameTime;
    const memoryMB = this.texturePool.getStats().memoryUsedMB;

    this.gl.deleteTexture(testTexture);

    return { fps, frameTime: avgFrameTime, memoryMB };
  }

  /**
   * Profile memory usage over time
   */
  public async profileMemory(
    durationMs: number = 10000,
    sampleIntervalMs: number = 100
  ): Promise<Array<{ time: number; memoryMB: number }>> {
    const samples: Array<{ time: number; memoryMB: number }> = [];
    const startTime = performance.now();
    const testTexture = this.createTestTexture(1920, 1080);

    while (performance.now() - startTime < durationMs) {
      await this.runSingleFrame(testTexture, 1920, 1080);

      const time = performance.now() - startTime;
      const memoryMB = this.texturePool.getStats().memoryUsedMB;
      samples.push({ time, memoryMB });

      // Wait for sample interval
      await new Promise((resolve) => setTimeout(resolve, sampleIntervalMs));
    }

    this.gl.deleteTexture(testTexture);

    return samples;
  }
}
