/**
 * Performance Tester Tests
 * Tests for the performance testing and benchmarking utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceTester } from './PerformanceTester';
import { PipelineManager } from './PipelineManager';
import { TexturePool } from './TexturePool';

describe('PerformanceTester', () => {
  let gl: WebGL2RenderingContext;
  let canvas: HTMLCanvasElement;
  let pipelineManager: PipelineManager;
  let texturePool: TexturePool;
  let tester: PerformanceTester;

  beforeEach(() => {
    // Create canvas and WebGL context
    canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('webgl2');
    if (!context) {
      throw new Error('WebGL2 not supported');
    }
    gl = context;

    // Create pipeline components
    pipelineManager = new PipelineManager(gl, {
      enableDebugger: true,
      enableProfiling: true,
    });

    texturePool = new TexturePool(gl, {
      maxPoolSize: 10,
      maxMemoryMB: 100,
    });

    tester = new PerformanceTester(gl, pipelineManager, texturePool);
  });

  it('should create performance tester', () => {
    expect(tester).toBeDefined();
  });

  it('should run quick test', async () => {
    const result = await tester.quickTest(256, 256);

    expect(result).toBeDefined();
    expect(result.fps).toBeGreaterThan(0);
    expect(result.frameTime).toBeGreaterThan(0);
    expect(result.memoryMB).toBeGreaterThanOrEqual(0);
  });

  it('should generate benchmark report', async () => {
    const results = await tester.runBenchmark({
      warmupRuns: 1,
      testRuns: 2,
      imageSizes: [
        { width: 256, height: 256, name: 'Small' },
      ],
    });

    expect(results).toBeDefined();
    expect(results.sizes).toHaveLength(1);
    expect(results.summary).toBeDefined();

    const report = tester.generateReport(results);
    expect(report).toContain('PERFORMANCE BENCHMARK REPORT');
    expect(report).toContain('Small');
  });

  it('should profile memory usage', async () => {
    const samples = await tester.profileMemory(500, 50);

    expect(samples).toBeDefined();
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0]).toHaveProperty('time');
    expect(samples[0]).toHaveProperty('memoryMB');
  });

  it('should measure frame times', async () => {
    const result = await tester.quickTest(256, 256);

    expect(result.frameTime).toBeGreaterThan(0);
    expect(result.frameTime).toBeLessThan(1000); // Should be less than 1 second
  });

  it('should calculate FPS correctly', async () => {
    const result = await tester.quickTest(256, 256);

    const expectedFPS = 1000 / result.frameTime;
    expect(Math.abs(result.fps - expectedFPS)).toBeLessThan(0.1);
  });
});
