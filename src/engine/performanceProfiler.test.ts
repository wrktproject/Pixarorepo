/**
 * Performance Profiler Tests
 * Tests for comprehensive performance monitoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceProfiler } from './performanceProfiler';

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler({
      enabled: true,
      sampleSize: 10,
      logInterval: 0, // Disable auto-logging for tests
      enableDetailedProfiling: true,
    });
  });

  describe('Frame Tracking', () => {
    it('should track frame times', () => {
      const startTime = profiler.startFrame();
      profiler.endFrame(startTime);

      const profile = profiler.getProfile();
      expect(profile.render.totalRenders).toBe(1);
      expect(profile.render.averageFrameTime).toBeGreaterThan(0);
    });

    it('should calculate FPS correctly', () => {
      // Simulate 60 FPS (16.67ms per frame)
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        // Simulate 16ms frame time
        while (performance.now() - startTime < 16) {
          // Busy wait
        }
        profiler.endFrame(startTime);
      }

      const profile = profiler.getProfile();
      expect(profile.render.currentFPS).toBeGreaterThan(50);
      expect(profile.render.currentFPS).toBeLessThan(70);
    });

    it('should track redundant renders', () => {
      profiler.recordRedundantRender();
      profiler.recordRedundantRender();

      const profile = profiler.getProfile();
      expect(profile.render.redundantRenders).toBe(2);
    });

    it('should track dropped frames', () => {
      profiler.recordDroppedFrame();
      profiler.recordDroppedFrame();

      const profile = profiler.getProfile();
      expect(profile.render.droppedFrames).toBe(2);
    });
  });

  describe('Shader Pass Tracking', () => {
    it('should track shader pass execution times', () => {
      const startTime = profiler.startPass('tonal');
      profiler.endPass('tonal', startTime, false);

      const profile = profiler.getProfile();
      const tonalPass = profile.shaderPasses.get('tonal');

      expect(tonalPass).toBeDefined();
      expect(tonalPass!.callCount).toBe(1);
      expect(tonalPass!.skippedCount).toBe(0);
      expect(tonalPass!.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should track skipped passes', () => {
      const startTime = profiler.startPass('color');
      profiler.endPass('color', startTime, true);

      const profile = profiler.getProfile();
      const colorPass = profile.shaderPasses.get('color');

      expect(colorPass).toBeDefined();
      expect(colorPass!.callCount).toBe(0);
      expect(colorPass!.skippedCount).toBe(1);
    });

    it('should calculate min/max execution times', () => {
      // First pass - fast
      let startTime = profiler.startPass('detail');
      profiler.endPass('detail', startTime, false);

      // Second pass - simulate slower
      startTime = performance.now();
      while (performance.now() - startTime < 5) {
        // Busy wait 5ms
      }
      profiler.endPass('detail', startTime, false);

      const profile = profiler.getProfile();
      const detailPass = profile.shaderPasses.get('detail');

      expect(detailPass).toBeDefined();
      expect(detailPass!.minExecutionTime).toBeLessThan(detailPass!.maxExecutionTime);
    });
  });

  describe('Texture Upload Tracking', () => {
    it('should track texture uploads', () => {
      const bytes = 1024 * 1024 * 4; // 4MB
      const duration = 10; // 10ms

      profiler.recordTextureUpload(bytes, duration, false);

      const profile = profiler.getProfile();
      expect(profile.textureUploads.count).toBe(1);
      expect(profile.textureUploads.totalBytes).toBe(bytes);
      expect(profile.textureUploads.totalTime).toBe(duration);
      expect(profile.textureUploads.reusedTextures).toBe(0);
    });

    it('should track texture reuse', () => {
      profiler.recordTextureUpload(1024, 5, true);
      profiler.recordTextureUpload(1024, 5, true);

      const profile = profiler.getProfile();
      expect(profile.textureUploads.reusedTextures).toBe(2);
    });

    it('should calculate average upload time', () => {
      profiler.recordTextureUpload(1024, 10, false);
      profiler.recordTextureUpload(1024, 20, false);
      profiler.recordTextureUpload(1024, 30, false);

      const profile = profiler.getProfile();
      expect(profile.textureUploads.averageTime).toBe(20);
    });
  });

  describe('Framebuffer Tracking', () => {
    it('should track framebuffer pool hits', () => {
      profiler.recordFramebufferPoolHit();
      profiler.recordFramebufferPoolHit();

      const profile = profiler.getProfile();
      expect(profile.framebuffers.poolHits).toBe(2);
    });

    it('should track framebuffer pool misses', () => {
      profiler.recordFramebufferPoolMiss();

      const profile = profiler.getProfile();
      expect(profile.framebuffers.poolMisses).toBe(1);
    });

    it('should track framebuffer creation and deletion', () => {
      profiler.recordFramebufferCreated();
      profiler.recordFramebufferCreated();
      profiler.recordFramebufferDeleted();

      const profile = profiler.getProfile();
      expect(profile.framebuffers.totalCreated).toBe(2);
      expect(profile.framebuffers.totalDeleted).toBe(1);
      expect(profile.framebuffers.activeFramebuffers).toBe(1);
    });
  });

  describe('GPU Memory Tracking', () => {
    it('should track GPU memory usage', () => {
      const bytes = 100 * 1024 * 1024; // 100MB
      profiler.updateGPUMemoryUsage(bytes);

      const profile = profiler.getProfile();
      expect(profile.gpuMemoryUsageMB).toBe(100);
    });
  });

  describe('Performance Recommendations', () => {
    it('should recommend frame skipping for low FPS', () => {
      profiler.setTargetFPS(60);

      // Simulate slow frames (100ms each = 10 FPS)
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        while (performance.now() - startTime < 100) {
          // Busy wait
        }
        profiler.endFrame(startTime);
      }

      const recommendations = profiler.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.includes('FPS'))).toBe(true);
    });

    it('should recommend pool size increase for low hit ratio', () => {
      // Simulate low pool hit ratio
      profiler.recordFramebufferPoolMiss();
      profiler.recordFramebufferPoolMiss();
      profiler.recordFramebufferPoolHit();

      const recommendations = profiler.getRecommendations();
      expect(recommendations.some((r) => r.includes('pool'))).toBe(true);
    });

    it('should warn about high GPU memory usage', () => {
      profiler.updateGPUMemoryUsage(600 * 1024 * 1024); // 600MB

      const recommendations = profiler.getRecommendations();
      expect(recommendations.some((r) => r.includes('GPU memory'))).toBe(true);
    });
  });

  describe('Enable/Disable', () => {
    it('should not track when disabled', () => {
      profiler.setEnabled(false);

      const startTime = profiler.startFrame();
      profiler.endFrame(startTime);

      const profile = profiler.getProfile();
      expect(profile.render.totalRenders).toBe(0);
    });

    it('should resume tracking when re-enabled', () => {
      profiler.setEnabled(false);
      profiler.setEnabled(true);

      const startTime = profiler.startFrame();
      profiler.endFrame(startTime);

      const profile = profiler.getProfile();
      expect(profile.render.totalRenders).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all statistics', () => {
      // Generate some data
      const startTime = profiler.startFrame();
      profiler.endFrame(startTime);
      profiler.recordTextureUpload(1024, 10, false);
      profiler.recordFramebufferPoolHit();

      // Reset
      profiler.reset();

      const profile = profiler.getProfile();
      expect(profile.render.totalRenders).toBe(0);
      expect(profile.textureUploads.count).toBe(0);
      expect(profile.framebuffers.poolHits).toBe(0);
    });
  });

  describe('Export', () => {
    it('should export profile as JSON', () => {
      const startTime = profiler.startFrame();
      profiler.endFrame(startTime);

      const json = profiler.exportProfile();
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json);
      expect(parsed.render).toBeDefined();
      expect(parsed.textureUploads).toBeDefined();
      expect(parsed.framebuffers).toBeDefined();
    });
  });

  describe('Performance Detection', () => {
    it('should detect when performance is below target', () => {
      profiler.setTargetFPS(60);

      // Simulate slow frames
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        while (performance.now() - startTime < 50) {
          // 50ms = 20 FPS
        }
        profiler.endFrame(startTime);
      }

      expect(profiler.isPerformanceBelowTarget()).toBe(true);
    });

    it('should detect when performance is at target', () => {
      profiler.setTargetFPS(60);

      // Simulate fast frames
      for (let i = 0; i < 5; i++) {
        const startTime = profiler.startFrame();
        profiler.endFrame(startTime);
      }

      expect(profiler.isPerformanceBelowTarget()).toBe(false);
    });
  });
});
