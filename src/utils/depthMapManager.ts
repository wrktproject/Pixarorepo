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
    // Store for later if callback not ready yet
    this.currentDepthMap = { data: depthData, width, height };
    
    // Notify the rendering pipeline
    if (this.callback) {
      this.callback(depthData, width, height);
    }
  }

  /**
   * Check if a depth map is available
   */
  hasDepthMap(): boolean {
    return this.currentDepthMap !== null;
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
