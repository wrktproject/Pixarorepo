/**
 * Memory Monitor
 * Tracks and reports memory usage across the pipeline
 * Implements task 13.2: Memory optimization - Add memory usage monitoring
 */

export interface MemorySnapshot {
  timestamp: number;
  textureMemoryMB: number;
  bufferMemoryMB: number;
  totalMemoryMB: number;
  memoryPressure: number;
  activeTextures: number;
  activeBuffers: number;
}

export interface MemoryAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  memoryUsageMB: number;
}

export interface MemoryMonitorConfig {
  enableMonitoring?: boolean;
  snapshotIntervalMs?: number;
  maxSnapshots?: number;
  warningThresholdMB?: number;
  criticalThresholdMB?: number;
  enableAlerts?: boolean;
}

/**
 * MemoryMonitor tracks memory usage and provides alerts
 */
export class MemoryMonitor {
  private config: Required<MemoryMonitorConfig>;
  private snapshots: MemorySnapshot[] = [];
  private alerts: MemoryAlert[] = [];
  private monitoringTimer: number | null = null;

  // Memory tracking
  private textureMemoryBytes = 0;
  private bufferMemoryBytes = 0;
  private activeTextures = 0;
  private activeBuffers = 0;

  // Alert callbacks
  private alertCallbacks: Array<(alert: MemoryAlert) => void> = [];

  constructor(config: MemoryMonitorConfig = {}) {
    this.config = {
      enableMonitoring: config.enableMonitoring ?? true,
      snapshotIntervalMs: config.snapshotIntervalMs ?? 1000,
      maxSnapshots: config.maxSnapshots ?? 60,
      warningThresholdMB: config.warningThresholdMB ?? 384,
      criticalThresholdMB: config.criticalThresholdMB ?? 480,
      enableAlerts: config.enableAlerts ?? true,
    };

    if (this.config.enableMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Start automatic memory monitoring
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.monitoringTimer = window.setInterval(() => {
      this.takeSnapshot();
    }, this.config.snapshotIntervalMs);
  }

  /**
   * Stop automatic memory monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Record texture memory allocation
   */
  public recordTextureAllocation(sizeBytes: number): void {
    this.textureMemoryBytes += sizeBytes;
    this.activeTextures++;
    this.checkMemoryThresholds();
  }

  /**
   * Record texture memory deallocation
   */
  public recordTextureDeallocation(sizeBytes: number): void {
    this.textureMemoryBytes = Math.max(0, this.textureMemoryBytes - sizeBytes);
    this.activeTextures = Math.max(0, this.activeTextures - 1);
  }

  /**
   * Record buffer memory allocation
   */
  public recordBufferAllocation(sizeBytes: number): void {
    this.bufferMemoryBytes += sizeBytes;
    this.activeBuffers++;
    this.checkMemoryThresholds();
  }

  /**
   * Record buffer memory deallocation
   */
  public recordBufferDeallocation(sizeBytes: number): void {
    this.bufferMemoryBytes = Math.max(0, this.bufferMemoryBytes - sizeBytes);
    this.activeBuffers = Math.max(0, this.activeBuffers - 1);
  }

  /**
   * Take a memory snapshot
   */
  public takeSnapshot(): MemorySnapshot {
    const now = performance.now();
    const textureMemoryMB = this.textureMemoryBytes / (1024 * 1024);
    const bufferMemoryMB = this.bufferMemoryBytes / (1024 * 1024);
    const totalMemoryMB = textureMemoryMB + bufferMemoryMB;

    const snapshot: MemorySnapshot = {
      timestamp: now,
      textureMemoryMB,
      bufferMemoryMB,
      totalMemoryMB,
      memoryPressure: totalMemoryMB / this.config.criticalThresholdMB,
      activeTextures: this.activeTextures,
      activeBuffers: this.activeBuffers,
    };

    this.snapshots.push(snapshot);

    // Limit snapshot history
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Check memory thresholds and generate alerts
   */
  private checkMemoryThresholds(): void {
    if (!this.config.enableAlerts) {
      return;
    }

    const totalMemoryMB = (this.textureMemoryBytes + this.bufferMemoryBytes) / (1024 * 1024);

    if (totalMemoryMB >= this.config.criticalThresholdMB) {
      this.addAlert({
        level: 'critical',
        message: `Critical memory usage: ${totalMemoryMB.toFixed(2)}MB / ${this.config.criticalThresholdMB}MB`,
        timestamp: performance.now(),
        memoryUsageMB: totalMemoryMB,
      });
    } else if (totalMemoryMB >= this.config.warningThresholdMB) {
      this.addAlert({
        level: 'warning',
        message: `High memory usage: ${totalMemoryMB.toFixed(2)}MB / ${this.config.warningThresholdMB}MB`,
        timestamp: performance.now(),
        memoryUsageMB: totalMemoryMB,
      });
    }
  }

  /**
   * Add a memory alert
   */
  private addAlert(alert: MemoryAlert): void {
    // Avoid duplicate alerts within 5 seconds
    const recentAlerts = this.alerts.filter(
      (a) => a.level === alert.level && alert.timestamp - a.timestamp < 5000
    );

    if (recentAlerts.length === 0) {
      this.alerts.push(alert);

      // Trigger callbacks
      for (const callback of this.alertCallbacks) {
        callback(alert);
      }

      // Log to console
      if (alert.level === 'critical') {
        console.error(alert.message);
      } else if (alert.level === 'warning') {
        console.warn(alert.message);
      } else {
        console.info(alert.message);
      }
    }
  }

  /**
   * Register alert callback
   */
  public onAlert(callback: (alert: MemoryAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current memory usage
   */
  public getCurrentUsage(): {
    textureMemoryMB: number;
    bufferMemoryMB: number;
    totalMemoryMB: number;
    memoryPressure: number;
  } {
    const textureMemoryMB = this.textureMemoryBytes / (1024 * 1024);
    const bufferMemoryMB = this.bufferMemoryBytes / (1024 * 1024);
    const totalMemoryMB = textureMemoryMB + bufferMemoryMB;

    return {
      textureMemoryMB,
      bufferMemoryMB,
      totalMemoryMB,
      memoryPressure: totalMemoryMB / this.config.criticalThresholdMB,
    };
  }

  /**
   * Get memory snapshots
   */
  public getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get recent alerts
   */
  public getAlerts(maxAge?: number): MemoryAlert[] {
    if (maxAge === undefined) {
      return [...this.alerts];
    }

    const now = performance.now();
    return this.alerts.filter((alert) => now - alert.timestamp < maxAge);
  }

  /**
   * Get memory statistics
   */
  public getStats(): {
    current: MemorySnapshot;
    peak: MemorySnapshot;
    average: { textureMemoryMB: number; bufferMemoryMB: number; totalMemoryMB: number };
    trend: 'increasing' | 'stable' | 'decreasing';
  } {
    const current = this.takeSnapshot();

    // Find peak usage
    let peak = current;
    for (const snapshot of this.snapshots) {
      if (snapshot.totalMemoryMB > peak.totalMemoryMB) {
        peak = snapshot;
      }
    }

    // Calculate average
    const sum = this.snapshots.reduce(
      (acc, s) => ({
        textureMemoryMB: acc.textureMemoryMB + s.textureMemoryMB,
        bufferMemoryMB: acc.bufferMemoryMB + s.bufferMemoryMB,
        totalMemoryMB: acc.totalMemoryMB + s.totalMemoryMB,
      }),
      { textureMemoryMB: 0, bufferMemoryMB: 0, totalMemoryMB: 0 }
    );

    const average = {
      textureMemoryMB: sum.textureMemoryMB / this.snapshots.length,
      bufferMemoryMB: sum.bufferMemoryMB / this.snapshots.length,
      totalMemoryMB: sum.totalMemoryMB / this.snapshots.length,
    };

    // Determine trend (compare recent vs older snapshots)
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.snapshots.length >= 10) {
      const recentAvg =
        this.snapshots.slice(-5).reduce((acc, s) => acc + s.totalMemoryMB, 0) / 5;
      const olderAvg =
        this.snapshots.slice(-10, -5).reduce((acc, s) => acc + s.totalMemoryMB, 0) / 5;

      if (recentAvg > olderAvg * 1.1) {
        trend = 'increasing';
      } else if (recentAvg < olderAvg * 0.9) {
        trend = 'decreasing';
      }
    }

    return { current, peak, average, trend };
  }

  /**
   * Generate memory report
   */
  public generateReport(): string {
    const stats = this.getStats();
    const recentAlerts = this.getAlerts(60000); // Last minute

    let report = '='.repeat(80) + '\n';
    report += 'MEMORY USAGE REPORT\n';
    report += '='.repeat(80) + '\n\n';

    report += 'Current Usage:\n';
    report += `  Texture Memory: ${stats.current.textureMemoryMB.toFixed(2)}MB\n`;
    report += `  Buffer Memory: ${stats.current.bufferMemoryMB.toFixed(2)}MB\n`;
    report += `  Total Memory: ${stats.current.totalMemoryMB.toFixed(2)}MB\n`;
    report += `  Memory Pressure: ${(stats.current.memoryPressure * 100).toFixed(1)}%\n`;
    report += `  Active Textures: ${stats.current.activeTextures}\n`;
    report += `  Active Buffers: ${stats.current.activeBuffers}\n\n`;

    report += 'Peak Usage:\n';
    report += `  Total Memory: ${stats.peak.totalMemoryMB.toFixed(2)}MB\n`;
    report += `  Timestamp: ${new Date(stats.peak.timestamp).toLocaleTimeString()}\n\n`;

    report += 'Average Usage:\n';
    report += `  Texture Memory: ${stats.average.textureMemoryMB.toFixed(2)}MB\n`;
    report += `  Buffer Memory: ${stats.average.bufferMemoryMB.toFixed(2)}MB\n`;
    report += `  Total Memory: ${stats.average.totalMemoryMB.toFixed(2)}MB\n\n`;

    report += `Memory Trend: ${stats.trend.toUpperCase()}\n\n`;

    if (recentAlerts.length > 0) {
      report += 'Recent Alerts (last minute):\n';
      report += '-'.repeat(80) + '\n';
      for (const alert of recentAlerts) {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        report += `  [${alert.level.toUpperCase()}] ${time}: ${alert.message}\n`;
      }
      report += '\n';
    }

    report += '='.repeat(80) + '\n';

    return report;
  }

  /**
   * Clear all snapshots and alerts
   */
  public clear(): void {
    this.snapshots = [];
    this.alerts = [];
  }

  /**
   * Reset memory counters
   */
  public reset(): void {
    this.textureMemoryBytes = 0;
    this.bufferMemoryBytes = 0;
    this.activeTextures = 0;
    this.activeBuffers = 0;
    this.clear();
  }

  /**
   * Enable or disable monitoring
   */
  public setMonitoringEnabled(enabled: boolean): void {
    this.config.enableMonitoring = enabled;
    if (enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.stopMonitoring();
    this.clear();
    this.alertCallbacks = [];
  }
}
