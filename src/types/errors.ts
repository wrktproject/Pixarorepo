/**
 * Error Types
 * Type definitions for error handling and error codes
 */

export const ErrorCode = {
  // File loading errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  FILE_READ_ERROR: 'FILE_READ_ERROR',

  // Processing errors
  WEBGL_NOT_SUPPORTED: 'WEBGL_NOT_SUPPORTED',
  WEBGL_CONTEXT_LOST: 'WEBGL_CONTEXT_LOST',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  OUT_OF_MEMORY: 'OUT_OF_MEMORY',
  SHADER_COMPILATION_ERROR: 'SHADER_COMPILATION_ERROR',

  // AI errors
  AI_MODEL_LOAD_FAILED: 'AI_MODEL_LOAD_FAILED',
  AI_PROCESSING_FAILED: 'AI_PROCESSING_FAILED',
  AI_TIMEOUT: 'AI_TIMEOUT',

  // Export errors
  EXPORT_FAILED: 'EXPORT_FAILED',
  EXPORT_TIMEOUT: 'EXPORT_TIMEOUT',
  INSUFFICIENT_STORAGE: 'INSUFFICIENT_STORAGE',

  // Worker errors
  WORKER_INITIALIZATION_FAILED: 'WORKER_INITIALIZATION_FAILED',
  WORKER_TIMEOUT: 'WORKER_TIMEOUT',
  WORKER_COMMUNICATION_ERROR: 'WORKER_COMMUNICATION_ERROR',

  // Storage errors
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_ACCESS_DENIED: 'STORAGE_ACCESS_DENIED',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export type ErrorSeverity = 'warning' | 'error' | 'fatal';

export interface AppError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  details?: any;
}

export class PixaroError extends Error {
  code: ErrorCode;
  severity: ErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  details?: any;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'PixaroError';
    this.code = appError.code;
    this.severity = appError.severity;
    this.recoverable = appError.recoverable;
    this.userMessage = appError.userMessage;
    this.details = appError.details;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, PixaroError);
    }
  }
}

export interface ErrorHandlerOptions {
  onError?: (error: AppError) => void;
  logToConsole?: boolean;
  showToUser?: boolean;
}
