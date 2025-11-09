/**
 * Performance Monitor
 * Tracks and reports performance metrics for the application
 */

export interface PerformanceMetrics {
  // Load metrics
  initialLoadTime: number;
  timeToInteractive: number | null;
  
  // Adjustment metrics
  adjustmentLatency: {
    min: number;
    max: number;
    avg: number;
    samples: number;
  } | null;
  
  // Export metrics
  exportTime: {
    min: number;
    max: number;
    avg: number;
    samples: number;
  } | null;
  
  // Memory metrics
  memoryUsage: {
    jsHeapSize: number;
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
  } | null;
  
  // FPS metrics
  fps: number | null;
}

export interface PerformanceMark {
  name: string;
  startTime: number;
  duration?: number;
}

class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();
  private loadStartTime: number;
  private isInteractive = false;
  private interactiveTime: number | null = null;
  private fpsFrames: number[] = [];

  constructor() {
    this.loadStartTime = performance.now();
    this.setupPerformanceObserver();
    this.setupFPSMonitoring();
  }

  /**
   * Setup Performance Observer for navigation timing
   */
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Observe navigation timing
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            console.log('Navigation timing:', {
              domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
              loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
              domInteractive: navEntry.domInteractive - navEntry.fetchStart,
            });
          }
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  /**
   * Setup FPS monitoring
   */
  private setupFPSMonitoring(): void {
    if (typeof window === 'undefined') {
      return;
    }

    let lastTime = performance.now();
    let frames = 0;

    const measureFPS = () => {
      const now = performance.now();
      frames++;

      if (now >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (now - lastTime));
        this.fpsFrames.push(fps);
        
        // Keep only last 60 samples (1 minute at 1 sample/second)
        if (this.fpsFrames.length > 60) {
          this.fpsFrames.shift();
        }

        frames = 0;
        lastTime = now;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  /**
   * Mark the start of a performance measurement
   */
  public mark(name: string): void {
    this.marks.set(name, performance.now());
    
    // Use native Performance API if available
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark(name);
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Measure the duration since a mark
   */
  public measure(name: string, startMark: string): number {
    const startTime = this.marks.get(startMark);
    if (!startTime) {
      console.warn(`Start mark "${startMark}" not found`);
      return 0;
    }

    const duration = performance.now() - startTime;

    // Store measurement
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    // Use native Performance API if available
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark);
      } catch (error) {
        // Ignore errors
      }
    }

    return duration;
  }

  /**
   * Record adjustment latency
   */
  public recordAdjustmentLatency(duration: number): void {
    if (!this.measurements.has('adjustment-latency')) {
      this.measurements.set('adjustment-latency', []);
    }
    this.measurements.get('adjustment-latency')!.push(duration);

    // Log warning if latency exceeds target
    if (duration > 100) {
      console.warn(`Adjustment latency exceeded target: ${duration.toFixed(2)}ms (target: 100ms)`);
    }
  }

  /**
   * Record export time
   */
  public recordExportTime(duration: number, fileSize: number): void {
    if (!this.measurements.has('export-time')) {
      this.measurements.set('export-time', []);
    }
    this.measurements.get('export-time')!.push(duration);

    console.log(`Export completed in ${duration.toFixed(2)}ms (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    // Log warning if export time exceeds target for files under 25MB
    if (fileSize < 25 * 1024 * 1024 && duration > 5000) {
      console.warn(`Export time exceeded target: ${duration.toFixed(2)}ms (target: 5000ms for files < 25MB)`);
    }
  }

  /**
   * Mark application as interactive
   */
  public markInteractive(): void {
    if (!this.isInteractive) {
      this.isInteractive = true;
      this.interactiveTime = performance.now() - this.loadStartTime;
      
      console.log(`Time to interactive: ${this.interactiveTime.toFixed(2)}ms`);
      
      // Log warning if TTI exceeds target
      if (this.interactiveTime > 4000) {
        console.warn(`Time to interactive exceeded target: ${this.interactiveTime.toFixed(2)}ms (target: 4000ms)`);
      }
    }
  }

  /**
   * Get statistics for a measurement
   */
  private getStats(measurements: number[]): {
    min: number;
    max: number;
    avg: number;
    samples: number;
  } | null {
    if (measurements.length === 0) {
      return null;
    }

    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;

    return { min, max, avg, samples: measurements.length };
  }

  /**
   * Get all performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    const initialLoadTime = performance.now() - this.loadStartTime;
    
    const adjustmentMeasurements = this.measurements.get('adjustment-latency') || [];
    const exportMeasurements = this.measurements.get('export-time') || [];

    // Get memory info if available
    let memoryUsage = null;
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = {
        jsHeapSize: memory.usedJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
      };
    }

    // Calculate average FPS
    const avgFps = this.fpsFrames.length > 0
      ? Math.round(this.fpsFrames.reduce((sum, fps) => sum + fps, 0) / this.fpsFrames.length)
      : null;

    return {
      initialLoadTime,
      timeToInteractive: this.interactiveTime,
      adjustmentLatency: this.getStats(adjustmentMeasurements),
      exportTime: this.getStats(exportMeasurements),
      memoryUsage,
      fps: avgFps,
    };
  }

  /**
   * Log performance report
   */
  public logReport(): void {
    const metrics = this.getMetrics();

    console.group('📊 Performance Report');
    
    console.log('Load Metrics:');
    console.log(`  Initial Load Time: ${metrics.initialLoadTime.toFixed(2)}ms ${metrics.initialLoadTime > 3000 ? '⚠️' : '✅'}`);
    console.log(`  Time to Interactive: ${metrics.timeToInteractive?.toFixed(2) ?? 'N/A'}ms ${(metrics.timeToInteractive ?? 0) > 4000 ? '⚠️' : '✅'}`);

    if (metrics.adjustmentLatency) {
      console.log('\nAdjustment Latency:');
      console.log(`  Min: ${metrics.adjustmentLatency.min.toFixed(2)}ms`);
      console.log(`  Max: ${metrics.adjustmentLatency.max.toFixed(2)}ms`);
      console.log(`  Avg: ${metrics.adjustmentLatency.avg.toFixed(2)}ms ${metrics.adjustmentLatency.avg > 100 ? '⚠️' : '✅'}`);
      console.log(`  Samples: ${metrics.adjustmentLatency.samples}`);
    }

    if (metrics.exportTime) {
      console.log('\nExport Time:');
      console.log(`  Min: ${metrics.exportTime.min.toFixed(2)}ms`);
      console.log(`  Max: ${metrics.exportTime.max.toFixed(2)}ms`);
      console.log(`  Avg: ${metrics.exportTime.avg.toFixed(2)}ms`);
      console.log(`  Samples: ${metrics.exportTime.samples}`);
    }

    if (metrics.memoryUsage) {
      console.log('\nMemory Usage:');
      console.log(`  JS Heap Size: ${(metrics.memoryUsage.jsHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  JS Heap Limit: ${(metrics.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Total JS Heap: ${(metrics.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    }

    if (metrics.fps !== null) {
      console.log(`\nAverage FPS: ${metrics.fps} ${metrics.fps < 30 ? '⚠️' : '✅'}`);
    }

    console.groupEnd();
  }

  /**
   * Clear all measurements
   */
  public clear(): void {
    this.marks.clear();
    this.measurements.clear();
  }

  /**
   * Get performance entries from native API
   */
  public getPerformanceEntries(type?: string): PerformanceEntry[] {
    if (typeof performance === 'undefined' || !performance.getEntries) {
      return [];
    }

    if (type) {
      return performance.getEntriesByType(type);
    }

    return performance.getEntries();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const mark = (name: string) => performanceMonitor.mark(name);
export const measure = (name: string, startMark: string) => performanceMonitor.measure(name, startMark);
export const recordAdjustmentLatency = (duration: number) => performanceMonitor.recordAdjustmentLatency(duration);
export const recordExportTime = (duration: number, fileSize: number) => performanceMonitor.recordExportTime(duration, fileSize);
export const markInteractive = () => performanceMonitor.markInteractive();
export const getMetrics = () => performanceMonitor.getMetrics();
export const logReport = () => performanceMonitor.logReport();
