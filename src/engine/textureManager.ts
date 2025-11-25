/**
 * Texture Manager
 * Handles WebGL texture creation, disposal, and caching with LRU eviction
 */

export interface TextureConfig {
  width: number;
  height: number;
  format?: number;
  type?: number;
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
}

interface CachedTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  lastUsed: number;
  key: string;
}

export class TextureManager {
  private gl: WebGL2RenderingContext;
  private textureCache: Map<string, CachedTexture> = new Map();
  private activeTextures: Set<WebGLTexture> = new Set();
  private textureDimensions: Map<WebGLTexture, { width: number; height: number }> = new Map();
  private maxCacheSize: number;
  private currentCacheSize = 0;
  private memoryPressureThreshold: number;
  private totalTexturesCreated = 0;
  private totalTexturesDeleted = 0;
  private profilerCallback: ((bytes: number, duration: number, wasReused: boolean) => void) | null = null;

  constructor(gl: WebGL2RenderingContext, maxCacheSizeMB = 512) {
    this.gl = gl;
    this.maxCacheSize = maxCacheSizeMB * 1024 * 1024; // Convert to bytes
    this.memoryPressureThreshold = this.maxCacheSize * 0.8; // 80% threshold
    this.setupMemoryPressureMonitoring();
  }

  /**
   * Set profiler callback for tracking texture uploads
   */
  public setProfilerCallback(callback: (bytes: number, duration: number, wasReused: boolean) => void): void {
    this.profilerCallback = callback;
  }

  /**
   * Setup memory pressure monitoring
   */
  private setupMemoryPressureMonitoring(): void {
    // Check for memory pressure periodically
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        this.checkMemoryPressure();
      }, 5000); // Check every 5 seconds
    }
  }

  /**
   * Check for memory pressure and evict if needed
   */
  private checkMemoryPressure(): void {
    if (this.currentCacheSize > this.memoryPressureThreshold) {
      console.warn(
        `Memory pressure detected: ${(this.currentCacheSize / (1024 * 1024)).toFixed(2)}MB / ${(this.maxCacheSize / (1024 * 1024)).toFixed(2)}MB`
      );
      this.evictOldestTextures(Math.floor(this.textureCache.size * 0.25)); // Evict 25% of cache
    }
  }

  /**
   * Create a texture from ImageData
   */
  public createTextureFromImageData(
    imageData: ImageData,
    config?: Partial<TextureConfig>
  ): WebGLTexture {
    const startTime = performance.now();
    
    const texture = this.createTexture({
      width: imageData.width,
      height: imageData.height,
      ...config,
    });

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      imageData.width,
      imageData.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      imageData.data
    );
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // Track active texture and its dimensions
    this.activeTextures.add(texture);
    this.textureDimensions.set(texture, { width: imageData.width, height: imageData.height });
    this.totalTexturesCreated++;

    // Profile texture upload
    const duration = performance.now() - startTime;
    const bytes = imageData.width * imageData.height * 4;
    if (this.profilerCallback) {
      this.profilerCallback(bytes, duration, false);
    }

    return texture;
  }

  /**
   * Update an existing texture with new ImageData
   * More efficient than creating a new texture when dimensions match
   * Optimizes texture uploads (Requirement 8.4)
   */
  public updateTextureFromImageData(
    texture: WebGLTexture,
    imageData: ImageData
  ): void {
    const startTime = performance.now();
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    
    // Use texSubImage2D for better performance when updating existing texture
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      0,
      imageData.width,
      imageData.height,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      imageData.data
    );
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // Profile texture upload (reused texture)
    const duration = performance.now() - startTime;
    const bytes = imageData.width * imageData.height * 4;
    if (this.profilerCallback) {
      this.profilerCallback(bytes, duration, true);
    }
  }

  /**
   * Create or update a texture from ImageData
   * Reuses existing texture if dimensions match for better performance
   */
  public createOrUpdateTextureFromImageData(
    existingTexture: WebGLTexture | null,
    imageData: ImageData,
    config?: Partial<TextureConfig>
  ): WebGLTexture {
    // If no existing texture, create new
    if (!existingTexture) {
      return this.createTextureFromImageData(imageData, config);
    }

    // Get the existing texture's dimensions from our tracking map
    const existingDims = this.textureDimensions.get(existingTexture);
    
    // If dimensions changed or not tracked, we MUST create a new texture
    // texSubImage2D cannot change texture dimensions
    if (!existingDims || existingDims.width !== imageData.width || existingDims.height !== imageData.height) {
      if (existingDims) {
        console.log('🔄 Texture dimensions changed:', {
          old: `${existingDims.width}x${existingDims.height}`,
          new: `${imageData.width}x${imageData.height}`,
        });
      }
      this.deleteTexture(existingTexture);
      return this.createTextureFromImageData(imageData, config);
    }

    // Dimensions match - update existing texture (more efficient)
    try {
      this.updateTextureFromImageData(existingTexture, imageData);
      return existingTexture;
    } catch (error) {
      // If update fails, create new texture
      console.warn('Failed to update texture, creating new one:', error);
      this.deleteTexture(existingTexture);
      return this.createTextureFromImageData(imageData, config);
    }
  }

  /**
   * Create an empty texture with specified configuration
   */
  public createTexture(config: TextureConfig): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create WebGL texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Set texture parameters
    const minFilter = config.minFilter ?? this.gl.LINEAR;
    const magFilter = config.magFilter ?? this.gl.LINEAR;
    const wrapS = config.wrapS ?? this.gl.CLAMP_TO_EDGE;
    const wrapT = config.wrapT ?? this.gl.CLAMP_TO_EDGE;

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, magFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, wrapS);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, wrapT);

    // Allocate texture storage
    const format = config.format ?? this.gl.RGBA;
    const type = config.type ?? this.gl.UNSIGNED_BYTE;

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      format,
      config.width,
      config.height,
      0,
      this.gl.RGBA,
      type,
      null
    );

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // Track active texture and its dimensions
    this.activeTextures.add(texture);
    this.textureDimensions.set(texture, { width: config.width, height: config.height });
    this.totalTexturesCreated++;

    return texture;
  }

  /**
   * Get or create a cached texture
   */
  public getCachedTexture(key: string, config: TextureConfig): WebGLTexture {
    const cached = this.textureCache.get(key);
    
    if (cached && cached.width === config.width && cached.height === config.height) {
      cached.lastUsed = Date.now();
      return cached.texture;
    }

    // Create new texture
    const texture = this.createTexture(config);
    const textureSize = this.estimateTextureSize(config.width, config.height);

    // Evict old textures if cache is full
    this.evictIfNeeded(textureSize);

    // Add to cache
    this.textureCache.set(key, {
      texture,
      width: config.width,
      height: config.height,
      lastUsed: Date.now(),
      key,
    });

    this.currentCacheSize += textureSize;

    return texture;
  }

  /**
   * Delete a specific texture
   */
  public deleteTexture(texture: WebGLTexture): void {
    this.gl.deleteTexture(texture);

    // Remove from active textures and dimension tracking
    this.activeTextures.delete(texture);
    this.textureDimensions.delete(texture);
    this.totalTexturesDeleted++;

    // Remove from cache if present
    for (const [key, cached] of this.textureCache.entries()) {
      if (cached.texture === texture) {
        const size = this.estimateTextureSize(cached.width, cached.height);
        this.currentCacheSize -= size;
        this.textureCache.delete(key);
        break;
      }
    }
  }

  /**
   * Clear all cached textures
   */
  public clearCache(): void {
    for (const cached of this.textureCache.values()) {
      this.gl.deleteTexture(cached.texture);
      this.textureDimensions.delete(cached.texture);
    }
    this.textureCache.clear();
    this.currentCacheSize = 0;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.clearCache();
  }

  /**
   * Estimate texture memory size in bytes
   */
  private estimateTextureSize(width: number, height: number): number {
    // RGBA with 4 bytes per pixel
    return width * height * 4;
  }

  /**
   * Evict least recently used textures to make room
   */
  private evictIfNeeded(requiredSize: number): void {
    if (this.currentCacheSize + requiredSize <= this.maxCacheSize) {
      return;
    }

    // Sort by last used time (oldest first)
    const sorted = Array.from(this.textureCache.values()).sort(
      (a, b) => a.lastUsed - b.lastUsed
    );

    // Evict until we have enough space
    for (const cached of sorted) {
      if (this.currentCacheSize + requiredSize <= this.maxCacheSize) {
        break;
      }

      this.gl.deleteTexture(cached.texture);
      this.activeTextures.delete(cached.texture);
      this.textureDimensions.delete(cached.texture);
      this.totalTexturesDeleted++;
      const size = this.estimateTextureSize(cached.width, cached.height);
      this.currentCacheSize -= size;
      this.textureCache.delete(cached.key);
    }
  }

  /**
   * Evict oldest N textures
   */
  private evictOldestTextures(count: number): void {
    // Sort by last used time (oldest first)
    const sorted = Array.from(this.textureCache.values()).sort(
      (a, b) => a.lastUsed - b.lastUsed
    );

    // Evict the oldest N textures
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      const cached = sorted[i];
      this.gl.deleteTexture(cached.texture);
      this.activeTextures.delete(cached.texture);
      this.textureDimensions.delete(cached.texture);
      this.totalTexturesDeleted++;
      const size = this.estimateTextureSize(cached.width, cached.height);
      this.currentCacheSize -= size;
      this.textureCache.delete(cached.key);
    }
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    count: number;
    sizeMB: number;
    maxSizeMB: number;
    activeTextures: number;
    totalCreated: number;
    totalDeleted: number;
    memoryPressure: number; // 0-1 scale
  } {
    return {
      count: this.textureCache.size,
      sizeMB: this.currentCacheSize / (1024 * 1024),
      maxSizeMB: this.maxCacheSize / (1024 * 1024),
      activeTextures: this.activeTextures.size,
      totalCreated: this.totalTexturesCreated,
      totalDeleted: this.totalTexturesDeleted,
      memoryPressure: this.currentCacheSize / this.maxCacheSize,
    };
  }

  /**
   * Force garbage collection of unused textures
   */
  public forceGarbageCollection(): void {
    const before = this.textureCache.size;
    
    // Remove textures that haven't been used in the last 30 seconds
    const now = Date.now();
    const threshold = 30000; // 30 seconds

    for (const [key, cached] of this.textureCache.entries()) {
      if (now - cached.lastUsed > threshold) {
        this.gl.deleteTexture(cached.texture);
        this.activeTextures.delete(cached.texture);
        this.textureDimensions.delete(cached.texture);
        this.totalTexturesDeleted++;
        const size = this.estimateTextureSize(cached.width, cached.height);
        this.currentCacheSize -= size;
        this.textureCache.delete(key);
      }
    }

    const after = this.textureCache.size;
    if (before > after) {
      console.log(`Garbage collected ${before - after} unused textures`);
    }
  }

  /**
   * Get GPU memory usage estimate
   */
  public getGPUMemoryUsage(): {
    estimatedMB: number;
    activeTextures: number;
    cachedTextures: number;
  } {
    return {
      estimatedMB: this.currentCacheSize / (1024 * 1024),
      activeTextures: this.activeTextures.size,
      cachedTextures: this.textureCache.size,
    };
  }
}
