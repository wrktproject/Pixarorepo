/**
 * AI Inpainting Worker Manager
 * Manages communication with the AI inpainting worker with timeout handling
 */

import type { RemovalMask } from '../types/adjustments';
import type { AIInpaintTask, WorkerResponse } from '../types/worker';

const INPAINTING_TIMEOUT = 5000; // 5 seconds max

let worker: Worker | null = null;

/**
 * Initialize the AI inpainting worker
 */
function initWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/aiInpainting.worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

/**
 * Perform AI inpainting with timeout
 */
export async function performAIInpainting(
  imageData: ImageData,
  mask: RemovalMask,
  timeout: number = INPAINTING_TIMEOUT
): Promise<ImageData> {
  const worker = initWorker();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('AI inpainting timeout exceeded'));
    }, timeout);

    const handleMessage = (event: MessageEvent<WorkerResponse<ImageData>>) => {
      clearTimeout(timeoutId);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      const response = event.data;

      if (response.success && response.data) {
        resolve(response.data);
      } else {
        reject(new Error(response.error || 'AI inpainting failed'));
      }
    };

    const handleError = (error: ErrorEvent) => {
      clearTimeout(timeoutId);
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(new Error(error.message || 'Worker error'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    const task: AIInpaintTask = {
      type: 'ai-inpaint',
      payload: {
        imageData,
        mask,
      },
    };

    worker.postMessage(task);
  });
}

/**
 * Terminate the worker
 */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

/**
 * Check if worker is initialized
 */
export function isWorkerInitialized(): boolean {
  return worker !== null;
}
