/**
 * Worker Pool
 * Manages a pool of Web Workers for efficient task execution
 */

export interface WorkerTask<T = any, R = any> {
  id: string;
  type: string;
  payload: T;
  transferables?: Transferable[];
  resolve: (result: R) => void;
  reject: (error: Error) => void;
  timeout?: number;
}

export interface WorkerPoolConfig {
  workerCount?: number;
  maxQueueSize?: number;
  defaultTimeout?: number;
}

interface PoolWorker {
  worker: Worker;
  busy: boolean;
  currentTask: WorkerTask | null;
  tasksCompleted: number;
}

export class WorkerPool {
  private workers: PoolWorker[] = [];
  private taskQueue: WorkerTask[] = [];
  private config: Required<WorkerPoolConfig>;
  private workerFactory: () => Worker;
  private isDisposed = false;

  constructor(workerFactory: () => Worker, config: WorkerPoolConfig = {}) {
    this.workerFactory = workerFactory;
    this.config = {
      workerCount: config.workerCount ?? this.getOptimalWorkerCount(),
      maxQueueSize: config.maxQueueSize ?? 100,
      defaultTimeout: config.defaultTimeout ?? 30000, // 30 seconds
    };

    this.initializeWorkers();
  }

  /**
   * Get optimal worker count based on CPU cores
   */
  private getOptimalWorkerCount(): number {
    if (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator) {
      // Use 2-4 workers, capped by available cores
      const cores = navigator.hardwareConcurrency || 4;
      return Math.min(Math.max(2, Math.floor(cores / 2)), 4);
    }
    return 2; // Default to 2 workers
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.config.workerCount; i++) {
      const worker = this.workerFactory();
      const poolWorker: PoolWorker = {
        worker,
        busy: false,
        currentTask: null,
        tasksCompleted: 0,
      };

      worker.onmessage = (event: MessageEvent) => {
        this.handleWorkerMessage(poolWorker, event);
      };

      worker.onerror = (error: ErrorEvent) => {
        this.handleWorkerError(poolWorker, error);
      };

      this.workers.push(poolWorker);
    }
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(poolWorker: PoolWorker, event: MessageEvent): void {
    const task = poolWorker.currentTask;
    if (!task) {
      console.warn('Received message from worker with no current task');
      return;
    }

    // Resolve the task
    task.resolve(event.data);

    // Mark worker as available
    poolWorker.busy = false;
    poolWorker.currentTask = null;
    poolWorker.tasksCompleted++;

    // Process next task in queue
    this.processNextTask();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(poolWorker: PoolWorker, error: ErrorEvent): void {
    const task = poolWorker.currentTask;
    if (task) {
      task.reject(new Error(`Worker error: ${error.message}`));
    }

    // Mark worker as available
    poolWorker.busy = false;
    poolWorker.currentTask = null;

    // Process next task in queue
    this.processNextTask();
  }

  /**
   * Execute a task using the worker pool
   */
  public execute<T = any, R = any>(
    type: string,
    payload: T,
    options: {
      transferables?: Transferable[];
      timeout?: number;
    } = {}
  ): Promise<R> {
    if (this.isDisposed) {
      return Promise.reject(new Error('Worker pool has been disposed'));
    }

    return new Promise<R>((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: this.generateTaskId(),
        type,
        payload,
        transferables: options.transferables,
        resolve,
        reject,
        timeout: options.timeout ?? this.config.defaultTimeout,
      };

      // Check queue size
      if (this.taskQueue.length >= this.config.maxQueueSize) {
        reject(new Error('Worker pool queue is full'));
        return;
      }

      // Add to queue
      this.taskQueue.push(task);

      // Try to process immediately
      this.processNextTask();
    });
  }

  /**
   * Process next task in queue
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Find available worker
    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) {
      return; // All workers busy
    }

    // Get next task
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Assign task to worker
    availableWorker.busy = true;
    availableWorker.currentTask = task;

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (availableWorker.currentTask === task) {
        task.reject(new Error(`Task timeout after ${task.timeout}ms`));
        availableWorker.busy = false;
        availableWorker.currentTask = null;
        this.processNextTask();
      }
    }, task.timeout);

    // Wrap resolve to clear timeout
    const originalResolve = task.resolve;
    task.resolve = (result) => {
      clearTimeout(timeoutId);
      originalResolve(result);
    };

    // Wrap reject to clear timeout
    const originalReject = task.reject;
    task.reject = (error) => {
      clearTimeout(timeoutId);
      originalReject(error);
    };

    // Post message to worker
    const message = {
      type: task.type,
      payload: task.payload,
    };

    if (task.transferables && task.transferables.length > 0) {
      availableWorker.worker.postMessage(message, task.transferables);
    } else {
      availableWorker.worker.postMessage(message);
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pool statistics
   */
  public getStats(): {
    totalWorkers: number;
    busyWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
    totalTasksCompleted: number;
  } {
    const busyWorkers = this.workers.filter((w) => w.busy).length;
    const totalTasksCompleted = this.workers.reduce(
      (sum, w) => sum + w.tasksCompleted,
      0
    );

    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      availableWorkers: this.workers.length - busyWorkers,
      queuedTasks: this.taskQueue.length,
      totalTasksCompleted,
    };
  }

  /**
   * Clear all queued tasks
   */
  public clearQueue(): void {
    // Reject all queued tasks
    for (const task of this.taskQueue) {
      task.reject(new Error('Task cancelled: queue cleared'));
    }
    this.taskQueue = [];
  }

  /**
   * Dispose the worker pool
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // Clear queue
    this.clearQueue();

    // Terminate all workers
    for (const poolWorker of this.workers) {
      if (poolWorker.currentTask) {
        poolWorker.currentTask.reject(new Error('Worker pool disposed'));
      }
      poolWorker.worker.terminate();
    }

    this.workers = [];
  }

  /**
   * Check if pool is disposed
   */
  public isPoolDisposed(): boolean {
    return this.isDisposed;
  }
}
