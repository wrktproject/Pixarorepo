/**
 * Worker Manager
 * Central manager for all worker pools in the application
 */

import { WorkerPool } from './workerPool';
import type { HistogramData } from './histogram.worker';

// Worker pool instances
let histogramPool: WorkerPool | null = null;
let exportPool: WorkerPool | null = null;
let aiPool: WorkerPool | null = null;

/**
 * Initialize histogram worker pool
 */
export function getHistogramPool(): WorkerPool {
  if (!histogramPool) {
    histogramPool = new WorkerPool(
      () => new Worker(new URL('./histogram.worker.ts', import.meta.url), { type: 'module' }),
      {
        workerCount: 2,
        maxQueueSize: 10,
        defaultTimeout: 5000,
      }
    );
  }
  return histogramPool;
}

/**
 * Initialize export worker pool
 */
export function getExportPool(): WorkerPool {
  if (!exportPool) {
    exportPool = new WorkerPool(
      () => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }),
      {
        workerCount: 2,
        maxQueueSize: 5,
        defaultTimeout: 30000,
      }
    );
  }
  return exportPool;
}

/**
 * Initialize AI worker pool
 */
export function getAIPool(): WorkerPool {
  if (!aiPool) {
    aiPool = new WorkerPool(
      () => new Worker(new URL('./aiInpainting.worker.ts', import.meta.url), { type: 'module' }),
      {
        workerCount: 1, // AI processing is memory-intensive, use only 1 worker
        maxQueueSize: 3,
        defaultTimeout: 10000,
      }
    );
  }
  return aiPool;
}

/**
 * Calculate histogram using worker pool
 */
export async function calculateHistogram(imageData: ImageData): Promise<HistogramData> {
  const pool = getHistogramPool();
  
  // Clone imageData for transfer
  const clonedData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  const result = await pool.execute<{ type: string; imageData: ImageData }, any>(
    'calculate',
    { type: 'calculate', imageData: clonedData },
    {
      // Use transferable objects to avoid copying
      transferables: [clonedData.data.buffer],
    }
  );

  return result.histogram;
}

/**
 * Export image using worker pool
 */
export async function exportImage(
  imageData: ImageData,
  format: 'jpeg' | 'png' | 'tiff',
  quality: number,
  metadata?: Record<string, any>
): Promise<Blob> {
  const pool = getExportPool();

  const result = await pool.execute<any, { blob: Blob }>(
    'export',
    {
      type: 'export',
      imageData,
      format,
      quality,
      metadata,
    },
    {
      timeout: 30000,
    }
  );

  return result.blob;
}

/**
 * Process AI inpainting using worker pool
 */
export async function processAIInpainting(
  imageData: ImageData,
  mask: Uint8Array,
  bounds: { x: number; y: number; width: number; height: number }
): Promise<ImageData> {
  const pool = getAIPool();

  const result = await pool.execute<any, { imageData: ImageData }>(
    'inpaint',
    {
      type: 'inpaint',
      imageData,
      mask,
      bounds,
    },
    {
      timeout: 10000,
    }
  );

  return result.imageData;
}

/**
 * Get statistics for all worker pools
 */
export function getAllPoolStats(): {
  histogram: ReturnType<WorkerPool['getStats']> | null;
  export: ReturnType<WorkerPool['getStats']> | null;
  ai: ReturnType<WorkerPool['getStats']> | null;
} {
  return {
    histogram: histogramPool?.getStats() ?? null,
    export: exportPool?.getStats() ?? null,
    ai: aiPool?.getStats() ?? null,
  };
}

/**
 * Dispose all worker pools
 */
export function disposeAllPools(): void {
  if (histogramPool) {
    histogramPool.dispose();
    histogramPool = null;
  }
  if (exportPool) {
    exportPool.dispose();
    exportPool = null;
  }
  if (aiPool) {
    aiPool.dispose();
    aiPool = null;
  }
}

/**
 * Clear all queues
 */
export function clearAllQueues(): void {
  histogramPool?.clearQueue();
  exportPool?.clearQueue();
  aiPool?.clearQueue();
}
