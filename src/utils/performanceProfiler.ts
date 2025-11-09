/**
 * Performance Profiler
 * Comprehensive performance profiling and bottleneck detection
 */

import { performanceMonitor } from './performanceMonitor';
import { getAllPoolStats } from '../workers/workerManager';

export interface ProfilerConfig {
  enableAutoLogging?: boolean;
  logInterval?: number; // in ms
  detectBottlenecks?: boolean;
}

export interface BottleneckReport {
  type: 'adjustment' | 'export' | 'memory' | 'fps' | 'worker';
  severity: 'low' | 'medium' | 'high';
  message: string;
  value: number;
  threshold: number;
}

class PerformanceProfiler {
  private config: Required<ProfilerConfig>;
  private intervalId: number | null = null;
  private bottlenecks: BottleneckReport[] = [];

  constructor(config: ProfilerConfig = {}) {
    this.config = {
      enableAutoLogging: config.enableAutoLogging ?? false,
      logInterval: config.logInterval ?? 10000, // 10 seconds
      detectBottlenecks: config.detectBottlenecks ?? true,
    };

    if (this.config.enableAutoLogging) {
      this.startAutoLogging();
    }
  }

  /**
   * Start automatic performance logging
   */
  public startAutoLogging(): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      this.logPerformanceSnapshot();
      
      if (this.config.detectBottlenecks) {
        this.detectBottlenecks();
      }
    }, this.config.logInterval);
  }

  /**
   * Stop automatic performance logging
   */
  public stopAutoLogging(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Log current performance snapshot
   */
  public logPerformanceSnapshot(): void {
    const metrics = performanceMonitor.getMetrics();
    const workerStats = getAllPoolStats();

    console.group('📊 Performance Snapshot');
    
    // Load metrics
    console.log('Load Metrics:');
    console.log(`  Initial Load: ${metrics.initialLoadTime.toFixed(2)}ms`);
    console.log(`  Time to Interactive: ${metrics.timeToInteractive?.toFixed(2) ?? 'N/A'}ms`);

    // Adjustment latency
    if (metrics.adjustmentLatency) {
      console.log('\nAdjustment Latency:');
      console.log(`  Avg: ${metrics.adjustmentLatency.avg.toFixed(2)}ms (target: <100ms)`);
      console.log(`  Min/Max: ${metrics.adjustmentLatency.min.toFixed(2)}ms / ${metrics.adjustmentLatency.max.toFixed(2)}ms`);
    }

    // Export time
    if (metrics.exportTime) {
      console.log('\nExport Time:');
      console.log(`  Avg: ${metrics.exportTime.avg.toFixed(2)}ms`);
      console.log(`  Min/Max: ${metrics.exportTime.min.toFixed(2)}ms / ${metrics.exportTime.max.toFixed(2)}ms`);
    }

    // Memory
    if (metrics.memoryUsage) {
      const usagePercent = (metrics.memoryUsage.jsHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
      console.log('\nMemory Usage:');
      console.log(`  Heap: ${(metrics.memoryUsage.jsHeapSize / 1024 / 1024).toFixed(2)}MB / ${(metrics.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB (${usagePercent.toFixed(1)}%)`);
    }

    // FPS
    if (metrics.fps !== null) {
      console.log(`\nFPS: ${metrics.fps}`);
    }

    // Worker stats
    console.log('\nWorker Pool Stats:');
    if (workerStats.histogram) {
      console.log(`  Histogram: ${workerStats.histogram.busyWorkers}/${workerStats.histogram.totalWorkers} busy, ${workerStats.histogram.queuedTasks} queued`);
    }
    if (workerStats.export) {
      console.log(`  Export: ${workerStats.export.busyWorkers}/${workerStats.export.totalWorkers} busy, ${workerStats.export.queuedTasks} queued`);
    }
    if (workerStats.ai) {
      console.log(`  AI: ${workerStats.ai.busyWorkers}/${workerStats.ai.totalWorkers} busy, ${workerStats.ai.queuedTasks} queued`);
    }

    console.groupEnd();
  }

  /**
   * Detect performance bottlenecks
   */
  public detectBottlenecks(): BottleneckReport[] {
    this.bottlenecks = [];
    const metrics = performanceMonitor.getMetrics();
    const workerStats = getAllPoolStats();

    // Check initial load time
    if (metrics.initialLoadTime > 3000) {
      this.bottlenecks.push({
        type: 'adjustment',
        severity: metrics.initialLoadTime > 5000 ? 'high' : 'medium',
        message: 'Initial load time exceeds target',
        value: metrics.initialLoadTime,
        threshold: 3000,
      });
    }

    // Check time to interactive
    if (metrics.timeToInteractive && metrics.timeToInteractive > 4000) {
      this.bottlenecks.push({
        type: 'adjustment',
        severity: metrics.timeToInteractive > 6000 ? 'high' : 'medium',
        message: 'Time to interactive exceeds target',
        value: metrics.timeToInteractive,
        threshold: 4000,
      });
    }

    // Check adjustment latency
    if (metrics.adjustmentLatency && metrics.adjustmentLatency.avg > 100) {
      this.bottlenecks.push({
        type: 'adjustment',
        severity: metrics.adjustmentLatency.avg > 200 ? 'high' : 'medium',
        message: 'Average adjustment latency exceeds target',
        value: metrics.adjustmentLatency.avg,
        threshold: 100,
      });
    }

    // Check export time
    if (metrics.exportTime && metrics.exportTime.avg > 5000) {
      this.bottlenecks.push({
        type: 'export',
        severity: metrics.exportTime.avg > 10000 ? 'high' : 'medium',
        message: 'Average export time exceeds target',
        value: metrics.exportTime.avg,
        threshold: 5000,
      });
    }

    // Check memory usage
    if (metrics.memoryUsage) {
      const usagePercent = (metrics.memoryUsage.jsHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        this.bottlenecks.push({
          type: 'memory',
          severity: usagePercent > 90 ? 'high' : 'medium',
          message: 'Memory usage is high',
          value: usagePercent,
          threshold: 80,
        });
      }
    }

    // Check FPS
    if (metrics.fps !== null && metrics.fps < 30) {
      this.bottlenecks.push({
        type: 'fps',
        severity: metrics.fps < 20 ? 'high' : 'medium',
        message: 'FPS is below acceptable threshold',
        value: metrics.fps,
        threshold: 30,
      });
    }

    // Check worker queue buildup
    if (workerStats.histogram && workerStats.histogram.queuedTasks > 5) {
      this.bottlenecks.push({
        type: 'worker',
        severity: workerStats.histogram.queuedTasks > 10 ? 'high' : 'medium',
        message: 'Histogram worker queue is building up',
        value: workerStats.histogram.queuedTasks,
        threshold: 5,
      });
    }

    if (workerStats.export && workerStats.export.queuedTasks > 3) {
      this.bottlenecks.push({
        type: 'worker',
        severity: 'medium',
        message: 'Export worker queue is building up',
        value: workerStats.export.queuedTasks,
        threshold: 3,
      });
    }

    // Log bottlenecks if found
    if (this.bottlenecks.length > 0) {
      console.group('⚠️ Performance Bottlenecks Detected');
      this.bottlenecks.forEach(bottleneck => {
        const icon = bottleneck.severity === 'high' ? '🔴' : bottleneck.severity === 'medium' ? '🟡' : '🟢';
        console.warn(
          `${icon} [${bottleneck.type}] ${bottleneck.message}: ${bottleneck.value.toFixed(2)} (threshold: ${bottleneck.threshold})`
        );
      });
      console.groupEnd();
    }

    return this.bottlenecks;
  }

  /**
   * Get current bottlenecks
   */
  public getBottlenecks(): BottleneckReport[] {
    return this.bottlenecks;
  }

  /**
   * Generate performance report
   */
  public generateReport(): string {
    const metrics = performanceMonitor.getMetrics();
    const workerStats = getAllPoolStats();
    const bottlenecks = this.detectBottlenecks();

    let report = '# Performance Report\n\n';

    // Summary
    report += '## Summary\n\n';
    report += `- Initial Load Time: ${metrics.initialLoadTime.toFixed(2)}ms ${metrics.initialLoadTime > 3000 ? '⚠️' : '✅'}\n`;
    report += `- Time to Interactive: ${metrics.timeToInteractive?.toFixed(2) ?? 'N/A'}ms ${(metrics.timeToInteractive ?? 0) > 4000 ? '⚠️' : '✅'}\n`;
    
    if (metrics.adjustmentLatency) {
      report += `- Avg Adjustment Latency: ${metrics.adjustmentLatency.avg.toFixed(2)}ms ${metrics.adjustmentLatency.avg > 100 ? '⚠️' : '✅'}\n`;
    }
    
    if (metrics.exportTime) {
      report += `- Avg Export Time: ${metrics.exportTime.avg.toFixed(2)}ms\n`;
    }
    
    if (metrics.fps !== null) {
      report += `- Average FPS: ${metrics.fps} ${metrics.fps < 30 ? '⚠️' : '✅'}\n`;
    }

    // Bottlenecks
    if (bottlenecks.length > 0) {
      report += '\n## Bottlenecks\n\n';
      bottlenecks.forEach(bottleneck => {
        const icon = bottleneck.severity === 'high' ? '🔴' : bottleneck.severity === 'medium' ? '🟡' : '🟢';
        report += `${icon} **[${bottleneck.type}]** ${bottleneck.message}\n`;
        report += `   - Value: ${bottleneck.value.toFixed(2)}\n`;
        report += `   - Threshold: ${bottleneck.threshold}\n\n`;
      });
    } else {
      report += '\n## Bottlenecks\n\nNo bottlenecks detected ✅\n';
    }

    // Worker stats
    report += '\n## Worker Pool Statistics\n\n';
    if (workerStats.histogram) {
      report += `- Histogram: ${workerStats.histogram.totalTasksCompleted} tasks completed\n`;
    }
    if (workerStats.export) {
      report += `- Export: ${workerStats.export.totalTasksCompleted} tasks completed\n`;
    }
    if (workerStats.ai) {
      report += `- AI: ${workerStats.ai.totalTasksCompleted} tasks completed\n`;
    }

    return report;
  }

  /**
   * Export report to file
   */
  public exportReport(): void {
    const report = this.generateReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Singleton instance
export const performanceProfiler = new PerformanceProfiler();

// Export convenience functions
export const startProfiling = () => performanceProfiler.startAutoLogging();
export const stopProfiling = () => performanceProfiler.stopAutoLogging();
export const detectBottlenecks = () => performanceProfiler.detectBottlenecks();
export const generateReport = () => performanceProfiler.generateReport();
export const exportReport = () => performanceProfiler.exportReport();
