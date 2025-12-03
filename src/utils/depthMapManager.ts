/**
 * Depth Map Manager
 * Singleton to manage depth map data and notify the rendering pipeline
 * Stores depth maps per photo ID so they persist when switching photos
 */

type DepthMapCallback = (depthData: Float32Array, width: number, height: number) => void;

interface DepthMapEntry {
  data: Float32Array;
  width: number;
  height: number;
}

class DepthMapManagerClass {
  private callback: DepthMapCallback | null = null;
  private currentDepthMap: DepthMapEntry | null = null;
  private currentPhotoId: string | null = null;
  
  // Store depth maps per photo ID for persistence when switching photos
  private depthMapCache: Map<string, DepthMapEntry> = new Map();
  private maxCacheSize = 5; // Limit memory usage - keep last 5 depth maps

  /**
   * Register a callback to receive depth map updates
   * Called by Canvas when the rendering pipeline is ready
   */
  setCallback(callback: DepthMapCallback | null): void {
    this.callback = callback;
    
    // If there's a pending depth map, send it immediately
    if (callback && this.currentDepthMap) {
      callback(
        this.currentDepthMap.data,
        this.currentDepthMap.width,
        this.currentDepthMap.height
      );
    }
  }

  /**
   * Set current photo ID - used to associate depth maps with photos
   */
  setCurrentPhotoId(photoId: string | null): void {
    if (photoId === this.currentPhotoId) return;
    
    console.log('📷 DepthMapManager: switching photo from', this.currentPhotoId, 'to', photoId);
    this.currentPhotoId = photoId;
    
    // Try to restore cached depth map for this photo
    if (photoId && this.depthMapCache.has(photoId)) {
      const cached = this.depthMapCache.get(photoId)!;
      console.log('📷 DepthMapManager: restoring cached depth map for', photoId);
      this.currentDepthMap = cached;
      
      // Notify the rendering pipeline
      if (this.callback) {
        this.callback(cached.data, cached.width, cached.height);
      }
    } else {
      // No cached depth map for this photo
      this.currentDepthMap = null;
    }
  }

  /**
   * Upload a depth map for the current photo
   * Called by LensBlurAdjustments when depth estimation completes
   */
  uploadDepthMap(depthData: Float32Array, width: number, height: number): void {
    console.log('📷 DepthMapManager.uploadDepthMap called:', { 
      photoId: this.currentPhotoId,
      width, 
      height, 
      dataLength: depthData.length 
    });
    
    // Check depth range
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < Math.min(1000, depthData.length); i++) {
      min = Math.min(min, depthData[i]);
      max = Math.max(max, depthData[i]);
    }
    console.log('📷 Depth data range (first 1000):', min, 'to', max);
    
    const entry: DepthMapEntry = { data: depthData, width, height };
    
    // Store for current use
    this.currentDepthMap = entry;
    
    // Cache for this photo ID
    if (this.currentPhotoId) {
      this.depthMapCache.set(this.currentPhotoId, entry);
      
      // Limit cache size to prevent memory issues
      if (this.depthMapCache.size > this.maxCacheSize) {
        // Remove oldest entry (first key)
        const firstKey = this.depthMapCache.keys().next().value;
        if (firstKey && firstKey !== this.currentPhotoId) {
          console.log('📷 DepthMapManager: evicting cached depth map for', firstKey);
          this.depthMapCache.delete(firstKey);
        }
      }
    }
    
    // Notify the rendering pipeline
    if (this.callback) {
      console.log('📷 Calling pipeline callback with depth map');
      this.callback(depthData, width, height);
    } else {
      console.warn('📷 No callback registered - depth map stored for later');
    }
  }

  /**
   * Check if a depth map is available for current photo
   */
  hasDepthMap(): boolean {
    return this.currentDepthMap !== null;
  }

  /**
   * Check if a depth map is cached for a specific photo
   */
  hasDepthMapForPhoto(photoId: string): boolean {
    return this.depthMapCache.has(photoId);
  }

  /**
   * Get depth value at a specific normalized coordinate (0-1)
   * @param x Normalized x coordinate (0 = left, 1 = right)
   * @param y Normalized y coordinate (0 = top, 1 = bottom)
   * @returns Depth value (0-1) or null if no depth map
   */
  getDepthAt(x: number, y: number): number | null {
    if (!this.currentDepthMap) return null;
    
    const { data, width, height } = this.currentDepthMap;
    
    // Clamp coordinates
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    
    // Convert to pixel coordinates
    const pixelX = Math.floor(clampedX * (width - 1));
    const pixelY = Math.floor(clampedY * (height - 1));
    
    // Sample depth
    const index = pixelY * width + pixelX;
    return data[index] ?? null;
  }

  /**
   * Get depth map dimensions
   */
  getDimensions(): { width: number; height: number } | null {
    if (!this.currentDepthMap) return null;
    return { width: this.currentDepthMap.width, height: this.currentDepthMap.height };
  }

  /**
   * Clear the current depth map (but keep cache)
   */
  clear(): void {
    this.currentDepthMap = null;
  }

  /**
   * Remove cached depth map for a specific photo
   * Called when a photo is deleted from the library
   */
  removeFromCache(photoId: string): void {
    this.depthMapCache.delete(photoId);
  }

  /**
   * Clear all cached depth maps
   */
  clearCache(): void {
    this.depthMapCache.clear();
    this.currentDepthMap = null;
  }
}

// Singleton instance
export const DepthMapManager = new DepthMapManagerClass();
