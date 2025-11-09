/**
 * usePerformance Hook
 * React hook for tracking component performance
 */

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';

export interface UsePerformanceOptions {
  componentName: string;
  trackRenders?: boolean;
  trackEffects?: boolean;
  logSlowRenders?: boolean;
  slowRenderThreshold?: number; // in ms
}

export function usePerformance(options: UsePerformanceOptions) {
  const {
    componentName,
    trackRenders = true,
    trackEffects = true,
    logSlowRenders = true,
    slowRenderThreshold = 16, // 60fps = 16.67ms per frame
  } = options;

  const renderCount = useRef(0);
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);

  // Track component mount
  useEffect(() => {
    mountTime.current = performance.now();
    performanceMonitor.mark(`${componentName}-mount`);

    return () => {
      // Track component unmount
      const duration = performanceMonitor.measure(
        `${componentName}-lifetime`,
        `${componentName}-mount`
      );
      console.log(`${componentName} lifetime: ${duration.toFixed(2)}ms`);
    };
  }, [componentName]);

  // Track renders
  if (trackRenders) {
    renderStartTime.current = performance.now();
  }

  useEffect(() => {
    if (trackRenders) {
      const renderDuration = performance.now() - renderStartTime.current;
      renderCount.current++;

      if (logSlowRenders && renderDuration > slowRenderThreshold) {
        console.warn(
          `Slow render detected in ${componentName}: ${renderDuration.toFixed(2)}ms (render #${renderCount.current})`
        );
      }
    }
  });

  // Measure effect execution time
  const measureEffect = useCallback(
    (effectName: string, fn: () => void | (() => void)) => {
      if (!trackEffects) {
        return fn();
      }

      const markName = `${componentName}-${effectName}-start`;
      performanceMonitor.mark(markName);

      const cleanup = fn();

      const duration = performanceMonitor.measure(
        `${componentName}-${effectName}`,
        markName
      );

      if (duration > 50) {
        console.warn(
          `Slow effect in ${componentName}.${effectName}: ${duration.toFixed(2)}ms`
        );
      }

      return cleanup;
    },
    [componentName, trackEffects]
  );

  // Measure async operation
  const measureAsync = useCallback(
    async <T,>(operationName: string, fn: () => Promise<T>): Promise<T> => {
      const markName = `${componentName}-${operationName}-start`;
      performanceMonitor.mark(markName);

      try {
        const result = await fn();
        const duration = performanceMonitor.measure(
          `${componentName}-${operationName}`,
          markName
        );

        console.log(
          `${componentName}.${operationName} completed in ${duration.toFixed(2)}ms`
        );

        return result;
      } catch (error) {
        console.error(`${componentName}.${operationName} failed:`, error);
        throw error;
      }
    },
    [componentName]
  );

  return {
    renderCount: renderCount.current,
    measureEffect,
    measureAsync,
  };
}

/**
 * Hook for tracking adjustment latency
 */
export function useAdjustmentPerformance() {
  const lastAdjustmentTime = useRef<number>(0);

  const trackAdjustment = useCallback(() => {
    const now = performance.now();
    if (lastAdjustmentTime.current > 0) {
      const latency = now - lastAdjustmentTime.current;
      performanceMonitor.recordAdjustmentLatency(latency);
    }
    lastAdjustmentTime.current = now;
  }, []);

  return { trackAdjustment };
}

/**
 * Hook for tracking export performance
 */
export function useExportPerformance() {
  const trackExport = useCallback(
    async <T,>(fn: () => Promise<T>, fileSize: number): Promise<T> => {
      const startTime = performance.now();

      try {
        const result = await fn();
        const duration = performance.now() - startTime;
        performanceMonitor.recordExportTime(duration, fileSize);
        return result;
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      }
    },
    []
  );

  return { trackExport };
}
