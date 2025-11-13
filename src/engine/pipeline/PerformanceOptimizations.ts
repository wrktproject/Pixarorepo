/**
 * Performance Optimizations
 * Central module for all performance optimization features
 * Implements task 13: Performance optimization
 */

export { 
  type ShaderQuality,
  type ShaderQualityPreset,
  shaderQualityPresets,
  optimizedColorSpaceConversions,
  optimizedSigmoidShader,
  optimizedMaskGeneration,
  generateShaderVariant,
  analyzeShaderOptimizations,
  generateOptimizedShaderHeader,
} from '../shaders/shaderOptimizations';

export {
  MemoryMonitor,
  type MemorySnapshot,
  type MemoryAlert,
  type MemoryMonitorConfig,
} from './MemoryMonitor';

export {
  ProgressiveRenderer,
  type ProgressiveRenderConfig,
  type RenderTile,
  type ProgressiveRenderState,
} from './ProgressiveRenderer';

export {
  PerformanceTester,
  type BenchmarkConfig,
  type BenchmarkResults,
  type ModuleBenchmark,
  type SizeBenchmark,
} from './PerformanceTester';

import type { ShaderQuality } from '../shaders/shaderOptimizations';

/**
 * Performance optimization configuration
 */
export interface PerformanceConfig {
  // Shader optimization
  shaderQuality?: ShaderQuality;
  useOptimizedShaders?: boolean;

  // Memory optimization
  enableMemoryMonitoring?: boolean;
  memoryWarningThresholdMB?: number;
  memoryCriticalThresholdMB?: number;
  enableAutoGarbageCollection?: boolean;

  // Pipeline optimization
  enableCaching?: boolean;
  enableDirtyTracking?: boolean;
  skipDisabledModules?: boolean;

  // Progressive rendering
  enableProgressiveRendering?: boolean;
  progressiveTileSize?: number;
  maxTilesPerFrame?: number;

  // Performance monitoring
  enableProfiling?: boolean;
  enablePerformanceAlerts?: boolean;
}

/**
 * Default performance configuration
 */
export const defaultPerformanceConfig: Required<PerformanceConfig> = {
  // Shader optimization
  shaderQuality: 'high',
  useOptimizedShaders: true,

  // Memory optimization
  enableMemoryMonitoring: true,
  memoryWarningThresholdMB: 384,
  memoryCriticalThresholdMB: 480,
  enableAutoGarbageCollection: true,

  // Pipeline optimization
  enableCaching: true,
  enableDirtyTracking: true,
  skipDisabledModules: true,

  // Progressive rendering
  enableProgressiveRendering: true,
  progressiveTileSize: 512,
  maxTilesPerFrame: 4,

  // Performance monitoring
  enableProfiling: true,
  enablePerformanceAlerts: true,
};

/**
 * Performance optimization recommendations
 */
export interface PerformanceRecommendation {
  category: 'shader' | 'memory' | 'pipeline' | 'rendering';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
}

/**
 * Analyze performance and provide recommendations
 */
export function analyzePerformance(stats: {
  avgFPS: number;
  avgFrameTime: number;
  memoryUsedMB: number;
  memoryLimitMB: number;
  poolHitRate: number;
  slowestModule?: { name: string; time: number };
}): PerformanceRecommendation[] {
  const recommendations: PerformanceRecommendation[] = [];

  // Check FPS
  if (stats.avgFPS < 30) {
    recommendations.push({
      category: 'rendering',
      priority: 'critical',
      title: 'Low Frame Rate',
      description: `Current FPS is ${stats.avgFPS.toFixed(1)}, which is below the target of 30 FPS.`,
      action: 'Consider reducing image resolution, disabling non-essential modules, or lowering shader quality.',
    });
  } else if (stats.avgFPS < 60) {
    recommendations.push({
      category: 'rendering',
      priority: 'medium',
      title: 'Suboptimal Frame Rate',
      description: `Current FPS is ${stats.avgFPS.toFixed(1)}, which is below the ideal 60 FPS.`,
      action: 'Consider optimizing shader passes or enabling progressive rendering for large images.',
    });
  }

  // Check memory usage
  const memoryPressure = stats.memoryUsedMB / stats.memoryLimitMB;
  if (memoryPressure > 0.9) {
    recommendations.push({
      category: 'memory',
      priority: 'critical',
      title: 'Critical Memory Pressure',
      description: `Memory usage is at ${(memoryPressure * 100).toFixed(1)}% of the limit.`,
      action: 'Run garbage collection, reduce texture pool size, or use lower precision textures (float16 instead of float32).',
    });
  } else if (memoryPressure > 0.75) {
    recommendations.push({
      category: 'memory',
      priority: 'high',
      title: 'High Memory Usage',
      description: `Memory usage is at ${(memoryPressure * 100).toFixed(1)}% of the limit.`,
      action: 'Monitor memory usage and consider enabling auto garbage collection.',
    });
  }

  // Check pool efficiency
  if (stats.poolHitRate < 0.5) {
    recommendations.push({
      category: 'memory',
      priority: 'medium',
      title: 'Low Texture Pool Hit Rate',
      description: `Pool hit rate is ${(stats.poolHitRate * 100).toFixed(1)}%, indicating inefficient texture reuse.`,
      action: 'Increase texture pool size or adjust texture allocation strategy.',
    });
  }

  // Check slowest module
  if (stats.slowestModule && stats.slowestModule.time > 10) {
    recommendations.push({
      category: 'shader',
      priority: 'high',
      title: 'Slow Module Detected',
      description: `Module "${stats.slowestModule.name}" takes ${stats.slowestModule.time.toFixed(2)}ms, which is significant.`,
      action: 'Consider optimizing this module\'s shader or disabling it if not essential.',
    });
  }

  return recommendations;
}

/**
 * Generate performance optimization report
 */
export function generateOptimizationReport(
  config: PerformanceConfig,
  _stats: any,
  recommendations: PerformanceRecommendation[]
): string {
  let report = '='.repeat(80) + '\n';
  report += 'PERFORMANCE OPTIMIZATION REPORT\n';
  report += '='.repeat(80) + '\n\n';

  report += 'Current Configuration:\n';
  report += '-'.repeat(80) + '\n';
  report += `Shader Quality: ${config.shaderQuality || 'default'}\n`;
  report += `Memory Monitoring: ${config.enableMemoryMonitoring ? 'Enabled' : 'Disabled'}\n`;
  report += `Pipeline Caching: ${config.enableCaching ? 'Enabled' : 'Disabled'}\n`;
  report += `Progressive Rendering: ${config.enableProgressiveRendering ? 'Enabled' : 'Disabled'}\n`;
  report += `Performance Profiling: ${config.enableProfiling ? 'Enabled' : 'Disabled'}\n\n`;

  if (recommendations.length > 0) {
    report += 'Recommendations:\n';
    report += '-'.repeat(80) + '\n';

    // Group by priority
    const critical = recommendations.filter((r) => r.priority === 'critical');
    const high = recommendations.filter((r) => r.priority === 'high');
    const medium = recommendations.filter((r) => r.priority === 'medium');
    const low = recommendations.filter((r) => r.priority === 'low');

    const addRecommendations = (recs: PerformanceRecommendation[], label: string) => {
      if (recs.length > 0) {
        report += `\n${label}:\n`;
        for (const rec of recs) {
          report += `\n  [${rec.category.toUpperCase()}] ${rec.title}\n`;
          report += `  ${rec.description}\n`;
          report += `  Action: ${rec.action}\n`;
        }
      }
    };

    addRecommendations(critical, 'CRITICAL');
    addRecommendations(high, 'HIGH PRIORITY');
    addRecommendations(medium, 'MEDIUM PRIORITY');
    addRecommendations(low, 'LOW PRIORITY');
  } else {
    report += 'No optimization recommendations at this time.\n';
    report += 'Performance is within acceptable parameters.\n';
  }

  report += '\n' + '='.repeat(80) + '\n';

  return report;
}

/**
 * Apply automatic optimizations based on current performance
 */
export function applyAutoOptimizations(
  _currentConfig: PerformanceConfig,
  stats: {
    avgFPS: number;
    memoryPressure: number;
  }
): Partial<PerformanceConfig> {
  const optimizations: Partial<PerformanceConfig> = {};

  // Auto-adjust shader quality based on FPS
  if (stats.avgFPS < 30) {
    optimizations.shaderQuality = 'low';
    optimizations.enableProgressiveRendering = true;
  } else if (stats.avgFPS < 45) {
    optimizations.shaderQuality = 'medium';
  }

  // Auto-enable garbage collection under memory pressure
  if (stats.memoryPressure > 0.8) {
    optimizations.enableAutoGarbageCollection = true;
  }

  return optimizations;
}
