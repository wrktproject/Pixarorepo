/**
 * Worker Pool
 * Manages a pool of Web Workers for parallel task execution
 */

import type { WorkerTask, WorkerResponse, WorkerPool, WorkerPoolConfig } from '../types/worker';

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
}

interface QueuedTask {
  task: WorkerTask;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

export class WorkerPoolImpl implements WorkerPool {
  private workers: WorkerInstance[] = [];
  private queue: QueuedTask[] = [];
  private maxWorkers: number;
  private workerScript: string;

  constructor(config: WorkerPoolConfig) {
    this.maxWorkers = config.maxWorkers;
    this.workerScript = config.workerScript;
  }

  /**
   * Execute a task using an available worker
   */
  async execute<T>(task: WorkerTask, timeout: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedTask: QueuedTask = {
        task,
        resolve,
        reject,
        timeout,
      };

      this.queue.push(queuedTask);
      this.processQueue();
    });
  }

  /**
   * Process the task queue
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    // Find an available worker
    let workerInstance = this.workers.find((w) => !w.busy);

    // Create a new worker if none available and under max limit
    if (!workerInstance && this.workers.length < this.maxWorkers) {
      workerInstance = this.createWorker();
      this.workers.push(workerInstance);
    }

    // If still no worker available, wait for one to become free
    if (!workerInstance) {
      return;
    }

    // Get the next task from queue
    const queuedTask = this.queue.shift();
    if (!queuedTask) {
      return;
    }

    // Mark worker as busy
    workerInstance.busy = true;

    // Set up timeout
    let timeoutId: number | undefined;
    if (queuedTask.timeout) {
      timeoutId = window.setTimeout(() => {
        queuedTask.reject(new Error('Worker task timeout'));
        workerInstance!.busy = false;
        this.processQueue();
      }, queuedTask.timeout);
    }

    // Set up message handler
    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      workerInstance!.worker.removeEventListener('message', handleMessage);
      workerInstance!.worker.removeEventListener('error', handleError);
      workerInstance!.busy = false;

      if (event.data.success) {
        queuedTask.resolve(event.data.data);
      } else {
        queuedTask.reject(new Error(event.data.error || 'Worker task failed'));
      }

      // Process next task in queue
      this.processQueue();
    };

    const handleError = (error: ErrorEvent) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      workerInstance!.worker.removeEventListener('message', handleMessage);
      workerInstance!.worker.removeEventListener('error', handleError);
      workerInstance!.busy = false;

      queuedTask.reject(new Error(`Worker error: ${error.message}`));

      // Process next task in queue
      this.processQueue();
    };

    workerInstance.worker.addEventListener('message', handleMessage);
    workerInstance.worker.addEventListener('error', handleError);

    // Send task to worker
    workerInstance.worker.postMessage(queuedTask.task);
  }

  /**
   * Create a new worker instance
   */
  private createWorker(): WorkerInstance {
    const worker = new Worker(new URL(this.workerScript, import.meta.url), {
      type: 'module',
    });

    return {
      worker,
      busy: false,
    };
  }

  /**
   * Terminate all workers and clear queue
   */
  terminate(): void {
    this.workers.forEach((w) => w.worker.terminate());
    this.workers = [];
    this.queue.forEach((task) => task.reject(new Error('Worker pool terminated')));
    this.queue = [];
  }
}

/**
 * Create a worker pool for RAW decoding
 */
export function createRawDecoderPool(): WorkerPool {
  return new WorkerPoolImpl({
    maxWorkers: 2,
    workerScript: '../workers/rawDecoder.worker.ts',
  });
}
