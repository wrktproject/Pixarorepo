/**
 * Shader Pipeline Error Handler
 * Provides comprehensive error handling and fallback mechanisms for the shader pipeline
 * Requirement 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { ShaderPipeline } from './shaderPipeline';
import { CanvasFallbackRenderer } from './canvasFallback';
import { WebGLContextManager } from './webglContext';
import { PixaroError, ErrorCode } from '../types/errors';
import type { AdjustmentState } from '../types/adjustments';

export type RenderMode = 'webgl' | 'webgl-simple' | 'canvas2d';

export interface ErrorHandlerConfig {
  enableCanvas2DFallback: boolean; // For Lightroom-quality app, should be false
  logErrors: boolean;
  onError?: (error: PixaroError) => void;
  onFallback?: (mode: RenderMode, reason: string) => void;
}

export interface RenderResult {
  success: boolean;
  mode: RenderMode;
  error?: PixaroError;
}

/**
 * Shader Pipeline Error Handler
 * Wraps ShaderPipeline with comprehensive error handling and fallback mechanisms
 */
export class ShaderPipelineErrorHandler {
  private canvas: HTMLCanvasElement;
  private config: ErrorHandlerConfig;
  
  private currentMode: RenderMode = 'webgl';
  private pipeline: ShaderPipeline | null = null;
  private fallbackRenderer: CanvasFallbackRenderer | null = null;
  private contextManager: WebGLContextManager | null = null;
  
  private contextLostCount = 0;
  private readonly MAX_CONTEXT_LOSS_RETRIES = 3;
  private readonly CONTEXT_LOSS_RETRY_DELAY = 1000; // ms
  
  private shaderCompilationErrors: Map<string, number> = new Map();
  private readonly MAX_SHADER_ERRORS = 3;

  constructor(canvas: HTMLCanvasElement, config: Partial<ErrorHandlerConfig> = {}) {
    this.canvas = canvas;
    this.config = {
      enableCanvas2DFallback: config.enableCanvas2DFallback ?? false, // WebGL required by default for Lightroom quality
      logErrors: config.logErrors ?? true,
      onError: config.onError,
      onFallback: config.onFallback,
    };

    this.initialize();
  }

  /**
   * Initialize the rendering pipeline with error handling
   * Requirement 10.1: Detect shader compilation failures and log errors
   * Requirement 10.2: Fall back to simpler shaders if compilation fails
   */
  private initialize(): void {
    try {
      // Try to initialize WebGL pipeline
      this.initializeWebGL();
      this.currentMode = 'webgl';
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  /**
   * Initialize WebGL context and pipeline
   */
  private initializeWebGL(): void {
    try {
      // Initialize WebGL context with error handling
      this.contextManager = new WebGLContextManager({
        canvas: this.canvas,
        antialias: false,
        preserveDrawingBuffer: true, // Keep canvas content when tab goes to background
        preserveDrawingBuffer: false,
      });

      // Set up context loss handlers
      // Requirement 10.3: Handle WebGL context loss and restoration
      this.setupContextLossHandlers();

      // Initialize shader pipeline
      this.pipeline = new ShaderPipeline(this.contextManager, {
        maxPreviewSize: 2048,
        enableRenderScheduler: true,
        enablePerformanceMonitoring: true,
        targetFPS: 60,
        minFPS: 30,
      });

      if (this.config.logErrors) {
        console.log('WebGL pipeline initialized successfully');
      }
    } catch (error) {
      // Shader compilation or WebGL initialization failed
      throw this.createError(
        ErrorCode.WEBGL_NOT_SUPPORTED,
        'Failed to initialize WebGL pipeline',
        error
      );
    }
  }

  /**
   * Set up WebGL context loss and restoration handlers
   * Requirement 10.3: Handle WebGL context loss and restoration
   */
  private setupContextLossHandlers(): void {
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost.bind(this));
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored.bind(this));
  }

  /**
   * Handle WebGL context loss
   * Requirement 10.3: Handle WebGL context loss and restoration
   */
  private handleContextLost(event: Event): void {
    event.preventDefault();
    
    this.contextLostCount++;

    const error = this.createError(
      ErrorCode.WEBGL_CONTEXT_LOST,
      `WebGL context lost (${this.contextLostCount} times)`,
      null
    );

    if (this.config.logErrors) {
      console.error('WebGL context lost:', error);
    }

    if (this.config.onError) {
      this.config.onError(error);
    }

    // If context loss happens too frequently, fall back to Canvas 2D
    if (this.contextLostCount >= this.MAX_CONTEXT_LOSS_RETRIES) {
      this.fallbackToCanvas2D('Repeated WebGL context loss');
    }
  }

  /**
   * Handle WebGL context restoration
   * Requirement 10.3: Handle WebGL context loss and restoration
   */
  private handleContextRestored(): void {
    if (this.config.logErrors) {
      console.log('WebGL context restored, attempting to reinitialize pipeline');
    }

    // Wait a bit before reinitializing to ensure context is stable
    setTimeout(() => {
      try {
        // Dispose old pipeline
        if (this.pipeline) {
          this.pipeline.dispose();
          this.pipeline = null;
        }

        // Reinitialize WebGL
        this.initializeWebGL();
        
        if (this.config.logErrors) {
          console.log('WebGL pipeline reinitialized successfully after context restoration');
        }

        // Reset context loss count after successful restoration
        this.contextLostCount = 0;
      } catch (error) {
        if (this.config.logErrors) {
          console.error('Failed to reinitialize WebGL after context restoration:', error);
        }
        
        // Fall back to Canvas 2D if restoration fails
        this.fallbackToCanvas2D('Failed to restore WebGL context');
      }
    }, this.CONTEXT_LOSS_RETRY_DELAY);
  }

  /**
   * Handle initialization errors
   * Requirement 10.2: Fall back to simpler shaders if compilation fails
   * Requirement 10.4: Provide Canvas 2D fallback for basic adjustments (optional)
   */
  private handleInitializationError(error: any): void {
    const pixaroError = error instanceof PixaroError 
      ? error 
      : this.createError(ErrorCode.WEBGL_NOT_SUPPORTED, 'WebGL initialization failed', error);

    if (this.config.logErrors) {
      console.error('WebGL initialization failed:', pixaroError);
    }

    if (this.config.onError) {
      this.config.onError(pixaroError);
    }

    // Try fallback to Canvas 2D only if explicitly enabled
    // For Lightroom-quality app, this should be disabled
    if (this.config.enableCanvas2DFallback) {
      this.fallbackToCanvas2D('WebGL not available');
    } else {
      // WebGL is required - throw error with clear message
      const requiredError = this.createError(
        ErrorCode.WEBGL_NOT_SUPPORTED,
        'WebGL is required for professional photo editing',
        error
      );
      requiredError.severity = 'fatal';
      requiredError.userMessage = 'WebGL is required to run this application. Please use a modern browser with WebGL support enabled.';
      throw requiredError;
    }
  }

  /**
   * Fall back to Canvas 2D rendering
   * Requirement 10.4: Provide Canvas 2D fallback for basic adjustments
   */
  private fallbackToCanvas2D(reason: string): void {
    try {
      if (this.config.logErrors) {
        console.warn(`Falling back to Canvas 2D: ${reason}`);
      }

      // Dispose WebGL resources
      if (this.pipeline) {
        this.pipeline.dispose();
        this.pipeline = null;
      }
      if (this.contextManager) {
        this.contextManager.dispose();
        this.contextManager = null;
      }

      // Initialize Canvas 2D fallback
      this.fallbackRenderer = new CanvasFallbackRenderer(this.canvas);
      this.currentMode = 'canvas2d';

      if (this.config.onFallback) {
        this.config.onFallback(this.currentMode, reason);
      }

      if (this.config.logErrors) {
        console.log('Canvas 2D fallback initialized successfully');
      }
    } catch (error) {
      // Canvas 2D fallback failed - this is a fatal error
      const fatalError = this.createError(
        ErrorCode.BROWSER_NOT_SUPPORTED,
        'Both WebGL and Canvas 2D rendering failed',
        error
      );
      fatalError.severity = 'fatal';
      
      if (this.config.logErrors) {
        console.error('Fatal error: Canvas 2D fallback failed:', fatalError);
      }

      if (this.config.onError) {
        this.config.onError(fatalError);
      }

      throw fatalError;
    }
  }

  /**
   * Load an image into the rendering pipeline
   */
  public loadImage(imageData: ImageData): RenderResult {
    try {
      if (this.pipeline) {
        this.pipeline.loadImage(imageData);
        return { success: true, mode: this.currentMode };
      } else if (this.fallbackRenderer) {
        // Canvas 2D doesn't need to pre-load the image
        return { success: true, mode: this.currentMode };
      } else {
        throw new Error('No rendering pipeline available');
      }
    } catch (error) {
      return this.handleRenderError(error, 'loadImage');
    }
  }

  /**
   * Render with adjustments
   */
  public render(imageData: ImageData, adjustments: AdjustmentState): RenderResult {
    try {
      if (this.pipeline) {
        // Use WebGL pipeline
        this.pipeline.render(adjustments);
        return { success: true, mode: this.currentMode };
      } else if (this.fallbackRenderer) {
        // Use Canvas 2D fallback
        this.fallbackRenderer.render(imageData, adjustments);
        return { success: true, mode: this.currentMode };
      } else {
        throw new Error('No rendering pipeline available');
      }
    } catch (error) {
      return this.handleRenderError(error, 'render');
    }
  }

  /**
   * Handle render errors with fallback logic
   * Requirement 10.1: Detect shader compilation failures and log errors
   * Requirement 10.2: Fall back to simpler shaders if compilation fails
   */
  private handleRenderError(error: any, operation: string): RenderResult {
    const pixaroError = error instanceof PixaroError
      ? error
      : this.createError(ErrorCode.SHADER_COMPILATION_ERROR, `Render operation failed: ${operation}`, error);

    if (this.config.logErrors) {
      console.error(`Render error in ${operation}:`, pixaroError);
    }

    if (this.config.onError) {
      this.config.onError(pixaroError);
    }

    // Track shader compilation errors
    if (pixaroError.code === ErrorCode.SHADER_COMPILATION_ERROR) {
      const errorCount = (this.shaderCompilationErrors.get(operation) || 0) + 1;
      this.shaderCompilationErrors.set(operation, errorCount);

      // If too many shader errors, fall back to Canvas 2D (only if enabled)
      if (errorCount >= this.MAX_SHADER_ERRORS && this.config.enableCanvas2DFallback) {
        this.fallbackToCanvas2D('Repeated shader compilation failures');
        return { success: false, mode: this.currentMode, error: pixaroError };
      }
    }

    return { success: false, mode: this.currentMode, error: pixaroError };
  }

  /**
   * Create a PixaroError with proper formatting
   */
  private createError(code: ErrorCode, message: string, originalError: any): PixaroError {
    return new PixaroError({
      code,
      message,
      severity: 'error',
      recoverable: this.config.enableCanvas2DFallback,
      userMessage: this.getUserFriendlyMessage(code),
      details: originalError,
    });
  }

  /**
   * Get user-friendly error message
   * Requirement 10.5: Display user-friendly error messages
   */
  private getUserFriendlyMessage(code: ErrorCode): string {
    switch (code) {
      case ErrorCode.WEBGL_NOT_SUPPORTED:
        if (this.config.enableCanvas2DFallback) {
          return 'Your browser does not support WebGL. Using simplified rendering mode.';
        }
        return 'WebGL is required for professional photo editing. Please use a modern browser like Chrome, Firefox, Safari, or Edge.';
      
      case ErrorCode.WEBGL_CONTEXT_LOST:
        return 'Graphics context was lost. Attempting to restore...';
      
      case ErrorCode.SHADER_COMPILATION_ERROR:
        return 'An error occurred while processing the image. Please try reloading the page.';
      
      case ErrorCode.OUT_OF_MEMORY:
        return 'Not enough memory to process this image. Try closing other tabs or using a smaller image.';
      
      case ErrorCode.BROWSER_NOT_SUPPORTED:
        return 'Your browser does not support the required features for professional photo editing.';
      
      default:
        return 'An unexpected error occurred while processing the image.';
    }
  }

  /**
   * Get current rendering mode
   */
  public getCurrentMode(): RenderMode {
    return this.currentMode;
  }

  /**
   * Check if WebGL is available
   */
  public isWebGLAvailable(): boolean {
    return this.currentMode === 'webgl' && this.pipeline !== null;
  }

  /**
   * Check if using fallback renderer
   */
  public isUsingFallback(): boolean {
    return this.currentMode === 'canvas2d';
  }

  /**
   * Get performance metrics (only available in WebGL mode)
   */
  public getPerformanceMetrics() {
    if (this.pipeline) {
      return this.pipeline.getPerformanceMetrics();
    }
    return null;
  }

  /**
   * Get FPS (only available in WebGL mode)
   */
  public getFPS(): number {
    if (this.pipeline) {
      return this.pipeline.getFPS();
    }
    return 0;
  }

  /**
   * Check if performance is low (only available in WebGL mode)
   */
  public isLowPerformance(): boolean {
    if (this.pipeline) {
      return this.pipeline.isLowPerformance();
    }
    return false;
  }

  /**
   * Get preview dimensions
   */
  public getPreviewDimensions(): { width: number; height: number } {
    if (this.pipeline) {
      return this.pipeline.getPreviewDimensions();
    }
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /**
   * Get image dimensions
   */
  public getImageDimensions(): { width: number; height: number } {
    if (this.pipeline) {
      return this.pipeline.getImageDimensions();
    }
    return { width: this.canvas.width, height: this.canvas.height };
  }

  /**
   * Set quality mode
   */
  public setQualityMode(mode: 'preview' | 'export'): void {
    if (this.pipeline) {
      this.pipeline.setQualityMode(mode);
    }
  }

  /**
   * Enable or disable tone mapping
   */
  public setToneMappingEnabled(enabled: boolean): void {
    if (this.pipeline) {
      this.pipeline.setToneMappingEnabled(enabled);
    }
  }

  /**
   * Render to ImageData for export
   */
  public async renderToImageData(
    imageData: ImageData,
    adjustments: AdjustmentState
  ): Promise<ImageData> {
    try {
      if (this.pipeline) {
        return await this.pipeline.renderToImageData(imageData, adjustments);
      } else if (this.fallbackRenderer) {
        // For Canvas 2D, render and return the result
        this.fallbackRenderer.render(imageData, adjustments);
        return this.fallbackRenderer.getImageData();
      } else {
        throw new Error('No rendering pipeline available');
      }
    } catch (error) {
      const pixaroError = this.createError(
        ErrorCode.EXPORT_FAILED,
        'Failed to render image for export',
        error
      );
      
      if (this.config.onError) {
        this.config.onError(pixaroError);
      }
      
      throw pixaroError;
    }
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Remove event listeners
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost.bind(this));
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored.bind(this));

    // Dispose pipeline
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }

    // Dispose context manager
    if (this.contextManager) {
      this.contextManager.dispose();
      this.contextManager = null;
    }

    // Dispose fallback renderer
    if (this.fallbackRenderer) {
      this.fallbackRenderer.dispose();
      this.fallbackRenderer = null;
    }

    // Clear error tracking
    this.shaderCompilationErrors.clear();
  }
}
