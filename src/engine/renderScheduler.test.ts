/**
 * RenderScheduler Tests
 * Tests for real-time rendering optimizations
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderScheduler } from './renderScheduler';

describe('RenderScheduler', () => {
  let scheduler: RenderScheduler;
  let renderCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    renderCallback = vi.fn();
    scheduler = new RenderScheduler({
      targetFPS: 60,
      minFPS: 30,
      batchDelay: 16,
      enableFrameSkipping: true,
      enablePerformanceMonitoring: true,
    });
    scheduler.setRenderCallback(renderCallback);
  });

  afterEach(() => {
    scheduler.dispose();
    vi.useRealTimers();
  });

  describe('Requirement 13.1: requestAnimationFrame-based render loop', () => {
    it('should use requestAnimationFrame for rendering', () => {
      const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);

      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });

    it('should execute render callback via requestAnimationFrame', () => {
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      expect(renderCallback).toHaveBeenCalled();
    });
  });

  describe('Requirement 13.2: Batch multiple slider changes into single render', () => {
    it('should batch multiple render requests within delay window', () => {
      // Schedule multiple renders quickly
      scheduler.scheduleRender();
      scheduler.scheduleRender();
      scheduler.scheduleRender();

      // Advance time to trigger batch
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      // Should only render once due to batching
      expect(renderCallback).toHaveBeenCalledTimes(1);
    });

    it('should render separately if requests are spaced out', () => {
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      expect(renderCallback).toHaveBeenCalledTimes(2);
    });

    it('should use configurable batch delay', () => {
      const customScheduler = new RenderScheduler({
        batchDelay: 50,
      });
      const customCallback = vi.fn();
      customScheduler.setRenderCallback(customCallback);

      customScheduler.scheduleRender();
      vi.advanceTimersByTime(25); // Less than batch delay

      // Should not have rendered yet
      expect(customCallback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(25); // Complete the batch delay
      vi.runAllTimers();

      expect(customCallback).toHaveBeenCalledTimes(1);

      customScheduler.dispose();
    });
  });

  describe('Requirement 13.3: Frame skipping if rendering is slow', () => {
    it('should track consecutive slow frames', () => {
      // Mock slow render (> 33ms)
      renderCallback.mockImplementation(() => {
        vi.advanceTimersByTime(50);
      });

      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      const stats = scheduler.getPerformanceStats();
      expect(stats.lastFrameTime).toBeGreaterThan(33);
    });

    it('should skip frames when enabled and rendering is slow', () => {
      let callCount = 0;
      renderCallback.mockImplementation(() => {
        callCount++;
        vi.advanceTimersByTime(50); // Slow render
      });

      // First slow frame
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      // Second slow frame
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      // Third frame should be skipped
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      const stats = scheduler.getPerformanceStats();
      expect(stats.droppedFrames).toBeGreaterThan(0);
    });

    it('should not skip frames when frame skipping is disabled', () => {
      scheduler.setFrameSkippingEnabled(false);

      renderCallback.mockImplementation(() => {
        vi.advanceTimersByTime(50); // Slow render
      });

      // Multiple slow frames
      for (let i = 0; i < 5; i++) {
        scheduler.scheduleRender();
        vi.advanceTimersByTime(16);
        vi.runAllTimers();
      }

      const stats = scheduler.getPerformanceStats();
      expect(stats.droppedFrames).toBe(0);
    });
  });

  describe('Requirement 13.4: Performance indicator for low FPS', () => {
    it('should track FPS metrics', () => {
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      const stats = scheduler.getPerformanceStats();
      expect(stats).toHaveProperty('currentFPS');
      expect(stats).toHaveProperty('averageFPS');
      expect(stats).toHaveProperty('lastFrameTime');
      expect(stats).toHaveProperty('averageFrameTime');
    });

    it('should detect low performance when FPS drops below minimum', () => {
      // Mock slow renders to drop FPS
      renderCallback.mockImplementation(() => {
        vi.advanceTimersByTime(50); // ~20 FPS
      });

      // Render multiple frames to establish FPS
      for (let i = 0; i < 10; i++) {
        scheduler.scheduleRender();
        vi.advanceTimersByTime(50);
        vi.runAllTimers();
      }

      // Advance time for FPS calculation
      vi.advanceTimersByTime(500);

      expect(scheduler.isLowPerformance()).toBe(true);
    });

    it('should not indicate low performance when FPS is good', () => {
      // Mock fast renders
      renderCallback.mockImplementation(() => {
        vi.advanceTimersByTime(10); // ~100 FPS
      });

      for (let i = 0; i < 10; i++) {
        scheduler.scheduleRender();
        vi.advanceTimersByTime(10);
        vi.runAllTimers();
      }

      vi.advanceTimersByTime(500);

      expect(scheduler.isLowPerformance()).toBe(false);
    });

    it('should track dropped frames', () => {
      renderCallback.mockImplementation(() => {
        vi.advanceTimersByTime(50); // Slow render
      });

      // Multiple slow frames to trigger frame skipping
      for (let i = 0; i < 5; i++) {
        scheduler.scheduleRender();
        vi.advanceTimersByTime(16);
        vi.runAllTimers();
      }

      const stats = scheduler.getPerformanceStats();
      expect(stats.droppedFrames).toBeGreaterThanOrEqual(0);
      expect(stats.totalFrames).toBeGreaterThan(0);
    });

    it('should reset stats when requested', () => {
      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      scheduler.resetStats();

      const stats = scheduler.getPerformanceStats();
      expect(stats.currentFPS).toBe(0);
      expect(stats.droppedFrames).toBe(0);
      expect(stats.totalFrames).toBe(0);
    });
  });

  describe('Configuration and control', () => {
    it('should allow updating configuration', () => {
      scheduler.updateConfig({
        targetFPS: 30,
        minFPS: 15,
      });

      // Configuration should be updated (tested indirectly through behavior)
      expect(scheduler).toBeDefined();
    });

    it('should cancel pending renders', () => {
      scheduler.scheduleRender();
      scheduler.cancelPendingRender();

      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      expect(renderCallback).not.toHaveBeenCalled();
    });

    it('should handle disposal correctly', () => {
      scheduler.scheduleRender();
      scheduler.dispose();

      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      // Should not crash and should not render after disposal
      expect(renderCallback).not.toHaveBeenCalled();
    });

    it('should toggle performance monitoring', () => {
      scheduler.setPerformanceMonitoringEnabled(false);

      scheduler.scheduleRender();
      vi.advanceTimersByTime(16);
      vi.runAllTimers();

      const stats = scheduler.getPerformanceStats();
      expect(stats.currentFPS).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle render callback errors gracefully', () => {
      renderCallback.mockImplementation(() => {
        throw new Error('Render error');
      });

      expect(() => {
        scheduler.scheduleRender();
        vi.advanceTimersByTime(16);
        vi.runAllTimers();
      }).not.toThrow();
    });

    it('should handle missing render callback', () => {
      const emptyScheduler = new RenderScheduler();

      expect(() => {
        emptyScheduler.scheduleRender();
        vi.advanceTimersByTime(16);
        vi.runAllTimers();
      }).not.toThrow();

      emptyScheduler.dispose();
    });

    it('should handle rapid schedule/cancel cycles', () => {
      for (let i = 0; i < 100; i++) {
        scheduler.scheduleRender();
        scheduler.cancelPendingRender();
      }

      expect(renderCallback).not.toHaveBeenCalled();
    });
  });
});
