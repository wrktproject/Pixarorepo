/**
 * Framebuffer Manager
 * Handles framebuffer creation and management for multi-pass rendering
 * Implements framebuffer pooling for efficient reuse and supports RGBA16F textures
 */

export type TextureFormat = 'rgba8' | 'rgba16f';

export interface FramebufferConfig {
  width: number;
  height: number;
  format?: TextureFormat;
  texture?: WebGLTexture;
}

interface FramebufferPoolEntry {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  format: TextureFormat;
  lastUsed: number;
  inUse: boolean;
}

export class FramebufferManager {
  private gl: WebGL2RenderingContext;
  private framebuffers: Map<string, WebGLFramebuffer> = new Map();
  private pool: FramebufferPoolEntry[] = [];
  private supportsFloat16: boolean;
  private maxPoolSize: number = 10;
  private cleanupInterval: number = 5000; // 5 seconds
  private cleanupTimer: number | null = null;
  private profilerCallbacks: {
    onPoolHit?: () => void;
    onPoolMiss?: () => void;
    onCreate?: () => void;
    onDelete?: () => void;
  } = {};

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.supportsFloat16 = this.checkFloat16Support();
    this.startAutoCleanup();
  }

  /**
   * Set profiler callbacks for tracking framebuffer operations
   */
  public setProfilerCallbacks(callbacks: {
    onPoolHit?: () => void;
    onPoolMiss?: () => void;
    onCreate?: () => void;
    onDelete?: () => void;
  }): void {
    this.profilerCallbacks = callbacks;
  }

  /**
   * Check if RGBA16F (half-float) textures are supported
   */
  private checkFloat16Support(): boolean {
    try {
      const ext = this.gl.getExtension('EXT_color_buffer_float');
      return ext !== null;
    } catch (e) {
      console.warn('Float texture support check failed:', e);
      return false;
    }
  }

  /**
   * Start automatic cleanup of unused framebuffers
   */
  private startAutoCleanup(): void {
    if (typeof window !== 'undefined') {
      this.cleanupTimer = window.setInterval(() => {
        this.cleanupUnusedFramebuffers();
      }, this.cleanupInterval);
    }
  }

  /**
   * Clean up framebuffers that haven't been used recently
   */
  private cleanupUnusedFramebuffers(): void {
    const now = Date.now();
    const maxAge = 10000; // 10 seconds

    this.pool = this.pool.filter((entry) => {
      if (!entry.inUse && now - entry.lastUsed > maxAge) {
        // Delete old unused framebuffer
        this.gl.deleteFramebuffer(entry.framebuffer);
        this.gl.deleteTexture(entry.texture);
        return false;
      }
      return true;
    });
  }

  /**
   * Get a framebuffer from the pool or create a new one
   * Implements framebuffer pooling for efficient reuse (Requirement 8.1)
   */
  public getFramebuffer(config: FramebufferConfig): {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  } {
    const format = config.format || 'rgba16f';
    const width = config.width;
    const height = config.height;

    // Try to find a matching framebuffer in the pool
    const poolEntry = this.pool.find(
      (entry) =>
        !entry.inUse &&
        entry.width === width &&
        entry.height === height &&
        entry.format === format
    );

    if (poolEntry) {
      // Reuse existing framebuffer from pool
      poolEntry.inUse = true;
      poolEntry.lastUsed = Date.now();
      
      // Track pool hit
      if (this.profilerCallbacks.onPoolHit) {
        this.profilerCallbacks.onPoolHit();
      }
      
      return {
        framebuffer: poolEntry.framebuffer,
        texture: poolEntry.texture,
      };
    }

    // Track pool miss
    if (this.profilerCallbacks.onPoolMiss) {
      this.profilerCallbacks.onPoolMiss();
    }

    // Create new framebuffer if none available in pool
    try {
      const result = this.createFramebuffer(config);

      // Add to pool if under max size
      if (this.pool.length < this.maxPoolSize) {
        this.pool.push({
          framebuffer: result.framebuffer,
          texture: result.texture,
          width,
          height,
          format,
          lastUsed: Date.now(),
          inUse: true,
        });
      }

      return result;
    } catch (error) {
      // Error handling for framebuffer creation failures (Requirement 10.2)
      console.error('Failed to create framebuffer:', error);
      throw new Error(
        `Framebuffer creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Release a framebuffer back to the pool
   */
  public releaseFramebuffer(framebuffer: WebGLFramebuffer): void {
    const entry = this.pool.find((e) => e.framebuffer === framebuffer);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Create a framebuffer with an attached texture (without pooling)
   * Supports RGBA16F (half-float) textures (Requirements 8.3, 14.1)
   * Note: For better performance, use getFramebuffer() which implements pooling
   */
  public createFramebuffer(config: FramebufferConfig): {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  } {
    const format = config.format || 'rgba16f';

    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

    // Use provided texture or create a new one
    let texture = config.texture;
    if (!texture) {
      texture = this.createTexture(config.width, config.height, format);
    }

    // Attach texture to framebuffer
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );

    // Check framebuffer status
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      // Clean up on failure
      this.gl.deleteFramebuffer(framebuffer);
      this.gl.deleteTexture(texture);
      throw new Error(`Framebuffer is not complete: ${this.getFramebufferStatusString(status)}`);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // Track creation
    if (this.profilerCallbacks.onCreate) {
      this.profilerCallbacks.onCreate();
    }

    return { framebuffer, texture };
  }

  /**
   * Create a texture with the specified format
   * Supports RGBA16F for high precision (Requirements 8.3, 14.1)
   */
  private createTexture(width: number, height: number, format: TextureFormat): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture for framebuffer');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Determine internal format and type based on requested format
    let internalFormat: number;
    let dataFormat: number;
    let dataType: number;

    if (format === 'rgba16f' && this.supportsFloat16) {
      // Use RGBA16F for high precision (Requirements 8.3, 14.1)
      internalFormat = this.gl.RGBA16F;
      dataFormat = this.gl.RGBA;
      dataType = this.gl.HALF_FLOAT;
    } else {
      // Fall back to RGBA8 if float16 not supported
      if (format === 'rgba16f' && !this.supportsFloat16) {
        console.warn('RGBA16F not supported, falling back to RGBA8');
      }
      internalFormat = this.gl.RGBA;
      dataFormat = this.gl.RGBA;
      dataType = this.gl.UNSIGNED_BYTE;
    }

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      internalFormat,
      width,
      height,
      0,
      dataFormat,
      dataType,
      null
    );

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    return texture;
  }

  /**
   * Bind a framebuffer for rendering
   */
  public bindFramebuffer(framebuffer: WebGLFramebuffer | null): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
  }

  /**
   * Delete a framebuffer
   */
  public deleteFramebuffer(framebuffer: WebGLFramebuffer): void {
    this.gl.deleteFramebuffer(framebuffer);
    
    // Track deletion
    if (this.profilerCallbacks.onDelete) {
      this.profilerCallbacks.onDelete();
    }
  }

  /**
   * Store a named framebuffer for reuse
   */
  public storeFramebuffer(name: string, framebuffer: WebGLFramebuffer): void {
    this.framebuffers.set(name, framebuffer);
  }

  /**
   * Get a stored framebuffer by name
   */
  public getStoredFramebuffer(name: string): WebGLFramebuffer | undefined {
    return this.framebuffers.get(name);
  }

  /**
   * Clear all stored framebuffers
   */
  public clearAll(): void {
    for (const framebuffer of this.framebuffers.values()) {
      this.gl.deleteFramebuffer(framebuffer);
    }
    this.framebuffers.clear();

    // Clear pool
    for (const entry of this.pool) {
      this.gl.deleteFramebuffer(entry.framebuffer);
      this.gl.deleteTexture(entry.texture);
    }
    this.pool = [];
  }

  /**
   * Dispose all resources and stop cleanup timer
   */
  public dispose(): void {
    // Stop auto cleanup
    if (this.cleanupTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clearAll();
  }

  /**
   * Get pool statistics for debugging
   */
  public getPoolStats(): {
    totalEntries: number;
    inUse: number;
    available: number;
    supportsFloat16: boolean;
  } {
    const inUse = this.pool.filter((e) => e.inUse).length;
    return {
      totalEntries: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      supportsFloat16: this.supportsFloat16,
    };
  }

  /**
   * Get human-readable framebuffer status string
   */
  private getFramebufferStatusString(status: number): string {
    switch (status) {
      case this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT';
      case this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        return 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT';
      case this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        return 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS';
      case this.gl.FRAMEBUFFER_UNSUPPORTED:
        return 'FRAMEBUFFER_UNSUPPORTED';
      default:
        return `Unknown status: ${status}`;
    }
  }
}
