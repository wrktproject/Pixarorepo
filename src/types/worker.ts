/**
 * Web Worker Types
 * Type definitions for Web Worker communication and task management
 */

import type { RemovalMask } from './adjustments';
import type { ExportSettings } from './components';

export type WorkerTaskType =
  | 'decode-raw'
  | 'ai-inpaint'
  | 'export'
  | 'histogram';

export interface WorkerTask {
  type: WorkerTaskType;
  payload: any;
}

export interface DecodeRawTask extends WorkerTask {
  type: 'decode-raw';
  payload: {
    fileBuffer: ArrayBuffer;
    fileName: string;
  };
}

export interface AIInpaintTask extends WorkerTask {
  type: 'ai-inpaint';
  payload: {
    imageData: ImageData;
    mask: RemovalMask;
  };
}

export interface ExportTask extends WorkerTask {
  type: 'export';
  payload: {
    imageData: ImageData;
    adjustments: any; // AdjustmentState - using any to avoid circular dependency
  };
}

export interface HistogramTask extends WorkerTask {
  type: 'histogram';
  payload: {
    imageData: ImageData;
  };
}

export interface WorkerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WorkerPool {
  execute<T>(task: WorkerTask, timeout?: number): Promise<T>;
  terminate(): void;
}

export interface WorkerPoolConfig {
  maxWorkers: number;
  workerScript: string;
}
