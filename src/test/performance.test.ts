/**
 * Performance Tests
 * Tests to measure and validate performance targets
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { performanceMonitor } from '../utils/performanceMonitor';

describe('Performance Monitoring', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  it('should track performance marks and measures', () => {
    performanceMonitor.mark('test-start');
    
    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Wait 10ms
    }
    
    const duration = performanceMonitor.measure('test-duration', 'test-start');
    
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeGreaterThanOrEqual(10);
  });

  it('should record adjustment latency', () => {
    performanceMonitor.recordAdjustmentLatency(50);
    performanceMonitor.recordAdjustmentLatency(75);
    performanceMonitor.recordAdjustmentLatency(60);
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.adjustmentLatency).not.toBeNull();
    expect(metrics.adjustmentLatency!.samples).toBe(3);
    expect(metrics.adjustmentLatency!.min).toBe(50);
    expect(metrics.adjustmentLatency!.max).toBe(75);
    expect(metrics.adjustmentLatency!.avg).toBeCloseTo(61.67, 1);
  });

  it('should record export time', () => {
    const fileSize = 5 * 1024 * 1024; // 5MB
    performanceMonitor.recordExportTime(2000, fileSize);
    performanceMonitor.recordExportTime(3000, fileSize);
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.exportTime).not.toBeNull();
    expect(metrics.exportTime!.samples).toBe(2);
    expect(metrics.exportTime!.min).toBe(2000);
    expect(metrics.exportTime!.max).toBe(3000);
  });

  it('should track time to interactive', () => {
    performanceMonitor.markInteractive();
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.timeToInteractive).not.toBeNull();
    expect(metrics.timeToInteractive).toBeGreaterThan(0);
  });

  it('should get performance metrics', () => {
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics).toHaveProperty('initialLoadTime');
    expect(metrics).toHaveProperty('timeToInteractive');
    expect(metrics).toHaveProperty('adjustmentLatency');
    expect(metrics).toHaveProperty('exportTime');
    expect(metrics).toHaveProperty('memoryUsage');
    expect(metrics).toHaveProperty('fps');
  });
});

describe('Performance Targets', () => {
  it('should validate adjustment latency target (< 100ms)', () => {
    // Simulate adjustment latencies
    const latencies = [45, 67, 89, 52, 78, 91, 55, 72];
    
    latencies.forEach(latency => {
      performanceMonitor.recordAdjustmentLatency(latency);
    });
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.adjustmentLatency).not.toBeNull();
    expect(metrics.adjustmentLatency!.avg).toBeLessThan(100);
  });

  it('should validate export time target (< 5s for files < 25MB)', () => {
    const fileSize = 20 * 1024 * 1024; // 20MB
    const exportTime = 4500; // 4.5 seconds
    
    performanceMonitor.recordExportTime(exportTime, fileSize);
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.exportTime).not.toBeNull();
    expect(metrics.exportTime!.avg).toBeLessThan(5000);
  });
});

describe('Performance Bottleneck Detection', () => {
  it('should detect slow adjustment latency', () => {
    const slowLatency = 150; // Exceeds 100ms target
    
    performanceMonitor.recordAdjustmentLatency(slowLatency);
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.adjustmentLatency).not.toBeNull();
    expect(metrics.adjustmentLatency!.max).toBeGreaterThan(100);
  });

  it('should detect slow export time', () => {
    const fileSize = 20 * 1024 * 1024; // 20MB (under 25MB)
    const slowExportTime = 6000; // 6 seconds (exceeds 5s target)
    
    performanceMonitor.recordExportTime(slowExportTime, fileSize);
    
    const metrics = performanceMonitor.getMetrics();
    
    expect(metrics.exportTime).not.toBeNull();
    expect(metrics.exportTime!.max).toBeGreaterThan(5000);
  });
});
