/**
 * Texture Pool
 * Efficient texture management with pooling, automatic sizing, and memory monitoring
 * Supports float16 and float32 textures for high-precision image processing
 */

export type TextureFormat = 'rgba8' | 'rgba16f' | 'rgba32f';
export type TextureFilter = 'nearest' | 'linear';
export type TextureWrap = 'clamp' | 'repeat' | 'mirror';

export interface TextureConfig {
  width: number;
  height: number;
  format?: TextureFormat;
  minFilter?: TextureFilter;
  magFilter?: TextureFilter;
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
}

interface PooledTexture {
  texture: WebGLTexture;
  config: Required<TextureConfig>;
  lastUsed: number;
  inUse: boolean;
  id: number;
}

export interface TexturePoolStats {
  totalTextures: number;
  inUse: number;
  available: number;
  memoryUsedMB: number;
  memoryLimitMB: number;
  memoryPressure: number; // 0-1
  texturesCreated: number;
  texturesReused: number;
  texturesDeleted: number;
  poolHits: number;
  poolMisses: number;
}

export interface TexturePoolConfig {
  maxPoolSize?: number;
  maxMemoryMB?: number;
  enableAutoCleanup?: boolean;
  cleanupIntervalMs?: number;
  maxTextureAge?: number;
}

/**
 * TexturePool manages WebGL textures with efficient pooling and reuse
 */
export class TexturePool {
  private gl: WebGL2RenderingContext;
  private pool: PooledTexture[] = [];
  private nextTextureId = 0;
  private config: Required<TexturePoolConfig>;

  // Statistics
  private stats = {
    texturesCreated: 0,
    texturesReused: 0,
    texturesDeleted: 0,
    poolHits: 0,
    poolMisses: 0,
    currentMemoryBytes: 0,
  };

  // Capabilities
  private supportsFloat16: boolean;
  private supportsFloat32: boolean;

  // Cleanup timer
  private cleanupTimer: number | null = null;

  constructor(gl: WebGL2RenderingContext, config: TexturePoolConfig = {}) {
    this.gl = gl;
    this.config = {
      maxPoolSize: config.maxPoolSize ?? 50,
      maxMemoryMB: config.maxMemoryMB ?? 512,
      enableAutoCleanup: config.enableAutoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 5000,
      maxTextureAge: config.maxTextureAge ?? 30000, // 30 seconds
    };

    // Check texture format support
    this.supportsFloat16 = this.checkFloat16Support();
    this.supportsFloat32 = this.checkFloat32Support();

    // Start auto cleanup if enabled
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Check if RGBA16F (half-float) textures are supported
   */
  private checkFloat16Support(): boolean {
    try {
      const ext = this.gl.getExtension('EXT_color_buffer_float');
      return ext !== null;
    } catch (e) {
      console.warn('Float16 texture support check failed:', e);
      return false;
    }
  }

  /**
   * Check if RGBA32F (float) textures are supported
   */
  private checkFloat32Support(): boolean {
    try {
      const ext = this.gl.getExtension('EXT_color_buffer_float');
      return ext !== null;
    } catch (e) {
      console.warn('Float32 texture support check failed:', e);
      return false;
    }
  }

  /**
   * Get WebGL internal format for texture format
   */
  private getInternalFormat(format: TextureFormat): number {
    switch (format) {
      case 'rgba8':
        return this.gl.RGBA8;
      case 'rgba16f':
        if (!this.supportsFloat16) {
          console.warn('RGBA16F not supported, falling back to RGBA8');
          return this.gl.RGBA8;
        }
        return this.gl.RGBA16F;
      case 'rgba32f':
        if (!this.supportsFloat32) {
          console.warn('RGBA32F not supported, falling back to RGBA16F or RGBA8');
          return this.supportsFloat16 ? this.gl.RGBA16F : this.gl.RGBA8;
        }
        return this.gl.RGBA32F;
      default:
        return this.gl.RGBA8;
    }
  }

  /**
   * Get WebGL data type for texture format
   */
  private getDataType(format: TextureFormat): number {
    switch (format) {
      case 'rgba8':
        return this.gl.UNSIGNED_BYTE;
      case 'rgba16f':
        return this.supportsFloat16 ? this.gl.HALF_FLOAT : this.gl.UNSIGNED_BYTE;
      case 'rgba32f':
        return this.supportsFloat32 ? this.gl.FLOAT : 
               (this.supportsFloat16 ? this.gl.HALF_FLOAT : this.gl.UNSIGNED_BYTE);
      default:
        return this.gl.UNSIGNED_BYTE;
    }
  }

  /**
   * Get WebGL filter mode
   */
  private getFilterMode(filter: TextureFilter): number {
    return filter === 'nearest' ? this.gl.NEAREST : this.gl.LINEAR;
  }

  /**
   * Get WebGL wrap mode
   */
  private getWrapMode(wrap: TextureWrap): number {
    switch (wrap) {
      case 'clamp':
        return this.gl.CLAMP_TO_EDGE;
      case 'repeat':
        return this.gl.REPEAT;
      case 'mirror':
        return this.gl.MIRRORED_REPEAT;
      default:
        return this.gl.CLAMP_TO_EDGE;
    }
  }

  /**
   * Estimate texture memory size in bytes
   */
  private estimateTextureSize(config: Required<TextureConfig>): number {
    const { width, height, format } = config;
    const pixelCount = width * height;

    switch (format) {
      case 'rgba8':
        return pixelCount * 4; // 4 bytes per pixel
      case 'rgba16f':
        return pixelCount * 8; // 8 bytes per pixel (4 channels * 2 bytes)
      case 'rgba32f':
        return pixelCount * 16; // 16 bytes per pixel (4 channels * 4 bytes)
      default:
        return pixelCount * 4;
    }
  }

  /**
   * Normalize texture configuration with defaults
   */
  private normalizeConfig(config: TextureConfig): Required<TextureConfig> {
    return {
      width: config.width,
      height: config.height,
      format: config.format ?? 'rgba16f',
      minFilter: config.minFilter ?? 'linear',
      magFilter: config.magFilter ?? 'linear',
      wrapS: config.wrapS ?? 'clamp',
      wrapT: config.wrapT ?? 'clamp',
    };
  }

  /**
   * Check if two texture configs match
   */
  private configsMatch(a: Required<TextureConfig>, b: Required<TextureConfig>): boolean {
    return (
      a.width === b.width &&
      a.height === b.height &&
      a.format === b.format &&
      a.minFilter === b.minFilter &&
      a.magFilter === b.magFilter &&
      a.wrapS === b.wrapS &&
      a.wrapT === b.wrapT
    );
  }

  /**
   * Create a new WebGL texture
   */
  private createTexture(config: Required<TextureConfig>): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Set texture parameters
    const minFilter = this.getFilterMode(config.minFilter);
    const magFilter = this.getFilterMode(config.magFilter);
    const wrapS = this.getWrapMode(config.wrapS);
    const wrapT = this.getWrapMode(config.wrapT);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, magFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, wrapS);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, wrapT);

    // Allocate texture storage
    const internalFormat = this.getInternalFormat(config.format);
    const dataType = this.getDataType(config.format);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      internalFormat,
      config.width,
      config.height,
      0,
      this.gl.RGBA,
      dataType,
      null
    );

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    return texture;
  }

  /**
   * Acquire a texture from the pool or create a new one
   */
  public acquire(config: TextureConfig): WebGLTexture {
    const normalizedConfig = this.normalizeConfig(config);

    // Try to find a matching texture in the pool
    const poolEntry = this.pool.find(
      (entry) => !entry.inUse && this.configsMatch(entry.config, normalizedConfig)
    );

    if (poolEntry) {
      // Reuse existing texture
      poolEntry.inUse = true;
      poolEntry.lastUsed = Date.now();
      this.stats.poolHits++;
      this.stats.texturesReused++;
      return poolEntry.texture;
    }

    // No matching texture found - create new one
    this.stats.poolMisses++;

    // Check memory pressure before creating
    const textureSize = this.estimateTextureSize(normalizedConfig);
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    if (this.stats.currentMemoryBytes + textureSize > maxMemoryBytes) {
      // Try to free up memory
      this.evictOldestTextures(Math.ceil(this.pool.length * 0.25));

      // Check again
      if (this.stats.currentMemoryBytes + textureSize > maxMemoryBytes) {
        console.warn(
          `Texture pool memory limit reached: ${(this.stats.currentMemoryBytes / (1024 * 1024)).toFixed(2)}MB / ${this.config.maxMemoryMB}MB`
        );
      }
    }

    // Create new texture
    const texture = this.createTexture(normalizedConfig);
    this.stats.texturesCreated++;
    this.stats.currentMemoryBytes += textureSize;

    // Add to pool if under max size
    if (this.pool.length < this.config.maxPoolSize) {
      this.pool.push({
        texture,
        config: normalizedConfig,
        lastUsed: Date.now(),
        inUse: true,
        id: this.nextTextureId++,
      });
    }

    return texture;
  }

  /**
   * Release a texture back to the pool
   */
  public release(texture: WebGLTexture): void {
    const entry = this.pool.find((e) => e.texture === texture);
    if (entry) {
      entry.inUse = false;
      entry.lastUsed = Date.now();
    }
  }

  /**
   * Delete a specific texture
   */
  public delete(texture: WebGLTexture): void {
    const index = this.pool.findIndex((e) => e.texture === texture);
    if (index !== -1) {
      const entry = this.pool[index];
      const textureSize = this.estimateTextureSize(entry.config);

      this.gl.deleteTexture(entry.texture);
      this.pool.splice(index, 1);
      this.stats.texturesDeleted++;
      this.stats.currentMemoryBytes -= textureSize;
    } else {
      // Texture not in pool, just delete it
      this.gl.deleteTexture(texture);
    }
  }

  /**
   * Evict oldest unused textures
   */
  private evictOldestTextures(count: number): void {
    // Sort by last used time (oldest first), only unused textures
    const unusedTextures = this.pool
      .filter((entry) => !entry.inUse)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    // Evict the oldest N textures
    const toEvict = unusedTextures.slice(0, Math.min(count, unusedTextures.length));

    for (const entry of toEvict) {
      const textureSize = this.estimateTextureSize(entry.config);
      this.gl.deleteTexture(entry.texture);
      this.stats.texturesDeleted++;
      this.stats.currentMemoryBytes -= textureSize;

      // Remove from pool
      const index = this.pool.indexOf(entry);
      if (index !== -1) {
        this.pool.splice(index, 1);
      }
    }

    if (toEvict.length > 0) {
      console.log(`Evicted ${toEvict.length} unused textures from pool`);
    }
  }

  /**
   * Start automatic cleanup of old textures
   */
  private startAutoCleanup(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.cleanupTimer = window.setInterval(() => {
      this.cleanupOldTextures();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Clean up textures that haven't been used recently
   */
  private cleanupOldTextures(): void {
    const now = Date.now();
    const maxAge = this.config.maxTextureAge;

    const toDelete: PooledTexture[] = [];

    for (const entry of this.pool) {
      if (!entry.inUse && now - entry.lastUsed > maxAge) {
        toDelete.push(entry);
      }
    }

    for (const entry of toDelete) {
      const textureSize = this.estimateTextureSize(entry.config);
      this.gl.deleteTexture(entry.texture);
      this.stats.texturesDeleted++;
      this.stats.currentMemoryBytes -= textureSize;

      const index = this.pool.indexOf(entry);
      if (index !== -1) {
        this.pool.splice(index, 1);
      }
    }

    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} old textures from pool`);
    }
  }

  /**
   * Get pool statistics
   */
  public getStats(): TexturePoolStats {
    const inUse = this.pool.filter((e) => e.inUse).length;
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    return {
      totalTextures: this.pool.length,
      inUse,
      available: this.pool.length - inUse,
      memoryUsedMB: this.stats.currentMemoryBytes / (1024 * 1024),
      memoryLimitMB: this.config.maxMemoryMB,
      memoryPressure: this.stats.currentMemoryBytes / maxMemoryBytes,
      texturesCreated: this.stats.texturesCreated,
      texturesReused: this.stats.texturesReused,
      texturesDeleted: this.stats.texturesDeleted,
      poolHits: this.stats.poolHits,
      poolMisses: this.stats.poolMisses,
    };
  }

  /**
   * Optimize texture precision based on usage
   * Automatically downgrade to float16 when float32 is not needed
   */
  public optimizePrecision(texture: WebGLTexture, requiresHighPrecision: boolean): WebGLTexture {
    const entry = this.pool.find((e) => e.texture === texture);
    if (!entry) {
      return texture;
    }

    // If already at optimal precision, return as-is
    if (requiresHighPrecision && entry.config.format === 'rgba32f') {
      return texture;
    }
    if (!requiresHighPrecision && entry.config.format === 'rgba16f') {
      return texture;
    }

    // Create new texture with optimal precision
    const newConfig = { ...entry.config };
    newConfig.format = requiresHighPrecision ? 'rgba32f' : 'rgba16f';

    const newTexture = this.acquire(newConfig);

    // Copy data from old texture to new texture (if needed)
    // Note: This is a simplified version - full implementation would copy pixel data

    // Release old texture
    this.release(texture);
    this.delete(texture);

    return newTexture;
  }

  /**
   * Force garbage collection of unused textures
   * Useful when memory pressure is high
   */
  public forceGarbageCollection(): number {
    const unusedTextures = this.pool.filter((e) => !e.inUse);
    let freedMemory = 0;

    for (const entry of unusedTextures) {
      const textureSize = this.estimateTextureSize(entry.config);
      this.gl.deleteTexture(entry.texture);
      this.stats.texturesDeleted++;
      this.stats.currentMemoryBytes -= textureSize;
      freedMemory += textureSize;

      const index = this.pool.indexOf(entry);
      if (index !== -1) {
        this.pool.splice(index, 1);
      }
    }

    if (freedMemory > 0) {
      console.log(`Force GC freed ${(freedMemory / (1024 * 1024)).toFixed(2)}MB`);
    }

    return freedMemory;
  }

  /**
   * Get memory usage breakdown by format
   */
  public getMemoryBreakdown(): Record<TextureFormat, { count: number; memoryMB: number }> {
    const breakdown: Record<TextureFormat, { count: number; memoryMB: number }> = {
      rgba8: { count: 0, memoryMB: 0 },
      rgba16f: { count: 0, memoryMB: 0 },
      rgba32f: { count: 0, memoryMB: 0 },
    };

    for (const entry of this.pool) {
      const format = entry.config.format;
      const size = this.estimateTextureSize(entry.config);
      breakdown[format].count++;
      breakdown[format].memoryMB += size / (1024 * 1024);
    }

    return breakdown;
  }

  /**
   * Suggest memory optimizations based on current usage
   */
  public suggestOptimizations(): string[] {
    const suggestions: string[] = [];
    const stats = this.getStats();
    const breakdown = this.getMemoryBreakdown();

    // Check memory pressure
    if (stats.memoryPressure > 0.9) {
      suggestions.push('Critical: Memory pressure above 90%. Consider reducing texture pool size or image resolution.');
    } else if (stats.memoryPressure > 0.75) {
      suggestions.push('Warning: Memory pressure above 75%. Monitor for potential issues.');
    }

    // Check pool efficiency
    const hitRate = stats.poolHits / (stats.poolHits + stats.poolMisses);
    if (hitRate < 0.5) {
      suggestions.push(`Low pool hit rate (${(hitRate * 100).toFixed(1)}%). Consider increasing pool size.`);
    }

    // Check for unused textures
    if (stats.available > stats.inUse * 2) {
      suggestions.push(`High number of unused textures (${stats.available}). Consider running garbage collection.`);
    }

    // Check precision usage
    if (breakdown.rgba32f.memoryMB > breakdown.rgba16f.memoryMB) {
      suggestions.push('High float32 usage. Consider using float16 for intermediate textures to save memory.');
    }

    // Check for format support
    if (!this.supportsFloat16) {
      suggestions.push('Float16 textures not supported. Performance may be impacted.');
    }

    return suggestions;
  }

  /**
   * Get texture format capabilities
   */
  public getCapabilities(): {
    supportsFloat16: boolean;
    supportsFloat32: boolean;
  } {
    return {
      supportsFloat16: this.supportsFloat16,
      supportsFloat32: this.supportsFloat32,
    };
  }

  /**
   * Clear all textures from the pool
   */
  public clear(): void {
    for (const entry of this.pool) {
      this.gl.deleteTexture(entry.texture);
    }
    this.pool = [];
    this.stats.currentMemoryBytes = 0;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Stop auto cleanup
    if (this.cleanupTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Clear all textures
    this.clear();
  }
}
