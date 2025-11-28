/**
 * WebGL Context Manager
 * Handles WebGL2 context initialization, error handling, and lifecycle management
 */

export interface WebGLContextConfig {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  preserveDrawingBuffer?: boolean;
  antialias?: boolean;
}

export class WebGLContextManager {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private contextLostHandler: ((event: Event) => void) | null = null;
  private contextRestoredHandler: ((event: Event) => void) | null = null;
  private isContextLost = false;

  constructor(config: WebGLContextConfig) {
    this.canvas = config.canvas;
    this.initializeContext(config);
  }

  private initializeContext(config: WebGLContextConfig): void {
    const contextAttributes: WebGLContextAttributes = {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: config.antialias ?? false,
      preserveDrawingBuffer: config.preserveDrawingBuffer ?? false,
      powerPreference: 'high-performance',
    };

    // Try WebGL2 first
    this.gl = this.canvas.getContext('webgl2', contextAttributes);

    if (!this.gl) {
      // Fallback to WebGL1 if WebGL2 is not available
      const gl1 = this.canvas.getContext('webgl', contextAttributes) || 
                  (this.canvas as HTMLCanvasElement).getContext('experimental-webgl' as 'webgl', contextAttributes);
      if (gl1) {
        console.warn('WebGL2 not available, falling back to WebGL1');
        this.gl = gl1 as WebGL2RenderingContext;
      } else {
        // WebGL is not supported - caller should handle fallback to Canvas 2D
        throw new Error('WebGL is not supported in this browser');
      }
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // OffscreenCanvas doesn't support context lost/restored events
    if (this.canvas instanceof OffscreenCanvas) {
      return;
    }

    this.contextLostHandler = (event: Event) => {
      event.preventDefault();
      this.isContextLost = true;
      console.error('WebGL context lost');
    };

    this.contextRestoredHandler = () => {
      this.isContextLost = false;
      console.log('WebGL context restored');
      // Context will need to be reinitialized by the caller
    };

    this.canvas.addEventListener('webglcontextlost', this.contextLostHandler);
    this.canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler);
  }

  public getContext(): WebGL2RenderingContext {
    if (!this.gl) {
      throw new Error('WebGL context not initialized');
    }
    if (this.isContextLost) {
      throw new Error('WebGL context is lost');
    }
    return this.gl;
  }

  public isContextValid(): boolean {
    return this.gl !== null && !this.isContextLost;
  }

  public dispose(): void {
    // Only remove event listeners for HTMLCanvasElement
    if (!(this.canvas instanceof OffscreenCanvas)) {
      if (this.contextLostHandler) {
        this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
      }
      if (this.contextRestoredHandler) {
        this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
      }
    }
    
    // Lose context to free resources
    if (this.gl) {
      const loseContext = this.gl.getExtension('WEBGL_lose_context');
      if (loseContext) {
        loseContext.loseContext();
      }
    }

    this.gl = null;
    this.contextLostHandler = null;
    this.contextRestoredHandler = null;
  }
}
