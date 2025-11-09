// Web Workers
// This folder contains Web Worker scripts for CPU-intensive operations

export { WorkerPool } from './workerPool';
export type { WorkerTask, WorkerPoolConfig } from './workerPool';

export {
  getHistogramPool,
  getExportPool,
  getAIPool,
  calculateHistogram,
  exportImage,
  processAIInpainting,
  getAllPoolStats,
  disposeAllPools,
  clearAllQueues,
} from './workerManager';

export type { HistogramData } from './histogram.worker';
