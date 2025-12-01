/**
 * Depth Map Manager
 * Singleton to manage depth map data and notify the rendering pipeline
 * This allows LensBlurAdjustments to communicate depth maps to Canvas
 */

type DepthMapCallback = (depthData: Float32Array, width: number, height: number) => void;

class DepthMapManagerClass {
  private callback: DepthMapCallback | null = null;
  private currentDepthMap: { data: Float32Array; width: number; height: number } | null = null;

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
   * Upload a depth map
   * Called by LensBlurAdjustments when depth estimation completes
   */
  uploadDepthMap(depthData: Float32Array, width: number, height: number): void {
    console.log('📷 DepthMapManager.uploadDepthMap called:', { width, height, dataLength: depthData.length });
    
    // Check depth range
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < Math.min(1000, depthData.length); i++) {
      min = Math.min(min, depthData[i]);
      max = Math.max(max, depthData[i]);
    }
    console.log('📷 Depth data range (first 1000):', min, 'to', max);
    
    // Store for later if callback not ready yet
    this.currentDepthMap = { data: depthData, width, height };
    
    // Notify the rendering pipeline
    if (this.callback) {
      console.log('📷 Calling pipeline callback with depth map');
      this.callback(depthData, width, height);
    } else {
      console.warn('📷 No callback registered - depth map stored for later');
    }
  }

  /**
   * Check if a depth map is available
   */
  hasDepthMap(): boolean {
    return this.currentDepthMap !== null;
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
   * Clear the current depth map
   * Called when image changes
   */
  clear(): void {
    this.currentDepthMap = null;
  }
}

// Singleton instance
export const DepthMapManager = new DepthMapManagerClass();
