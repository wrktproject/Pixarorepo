/**
 * Depth Estimation Client
 * Handles communication with the MiDaS depth estimation API
 * Provides proper depth map processing for lens blur
 */

/**
 * Resize image for API request (max dimension for performance)
 * Depth estimation works well at lower resolutions
 */
function resizeImageForAPI(imageData: ImageData, maxSize: number = 768): {
  resized: ImageData;
  scale: number;
} {
  const { width, height } = imageData;
  
  if (width <= maxSize && height <= maxSize) {
    return { resized: imageData, scale: 1 };
  }
  
  const scale = Math.min(maxSize / width, maxSize / height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  const ctx = canvas.getContext('2d')!;
  
  // Create temporary canvas to draw original ImageData
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
  // Draw scaled version with high quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
  
  return {
    resized: ctx.getImageData(0, 0, newWidth, newHeight),
    scale,
  };
}

/**
 * Convert ImageData to base64 JPEG for API
 */
function imageDataToBase64(imageData: ImageData, quality: number = 0.9): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Load an image from URL and return as HTMLImageElement
 */
async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load depth map image'));
    img.src = url;
  });
}

/**
 * Convert HTMLImageElement to ImageData at target resolution
 */
function imageToImageData(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Check if we're in local development mode
 */
function isLocalDevelopment(): boolean {
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.port === '5173' ||
         window.location.port === '5174';
}

/**
 * Yield to main thread to prevent blocking
 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Generate a simple gradient-based depth map for local development
 * This is a placeholder that creates a center-focused depth effect
 * Uses async chunked processing to avoid blocking the UI
 */
async function generateLocalDepthMapAsync(
  imageData: ImageData,
  onProgress?: (status: string) => void
): Promise<{ depthMap: Float32Array; width: number; height: number }> {
  const { width, height, data } = imageData;
  const depthMap = new Float32Array(width * height);
  
  onProgress?.('Generating local depth estimate...');
  
  // Calculate center of image
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  
  // Process in chunks to avoid blocking UI
  const chunkSize = 10000; // pixels per chunk
  const totalPixels = width * height;
  
  for (let start = 0; start < totalPixels; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPixels);
    
    for (let idx = start; idx < end; idx++) {
      const x = idx % width;
      const y = Math.floor(idx / width);
      const pixelIdx = idx * 4;
      
      // Distance from center (normalized 0-1)
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      
      // Luminance of pixel (rough foreground hint)
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Combine: center bias + slight luminance bias
      const centerBias = 1 - dist * 0.7;
      const luminanceBias = luminance * 0.2;
      
      depthMap[idx] = Math.min(1, Math.max(0, centerBias + luminanceBias));
    }
    
    // Yield to main thread every chunk
    await yieldToMain();
    
    // Update progress
    const progress = Math.round((end / totalPixels) * 60) + 20; // 20-80%
    onProgress?.(`Analyzing depth... ${progress}%`);
  }
  
  onProgress?.('Smoothing depth map...');
  await yieldToMain();
  
  // Apply fast smoothing (reduced radius for speed)
  const smoothed = applyFastSmoothing(depthMap, width, height, 2);
  
  return {
    depthMap: smoothed,
    width,
    height,
  };
}

/**
 * Fast box blur smoothing - much faster than bilateral for local mode
 */
function applyFastSmoothing(
  depth: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const result = new Float32Array(width * height);
  const kernelSize = (radius * 2 + 1);
  // Note: We use count instead of kernelArea for edge handling
  void kernelSize; // Used for documentation, suppresses unused warning
  
  // Simple box blur - much faster
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          sum += depth[ny * width + nx];
          count++;
        }
      }
      
      result[y * width + x] = sum / count;
    }
  }
  
  return result;
}

/**
 * Fetch depth map from server using MiDaS model
 * Returns normalized depth data as Float32Array
 */
export async function fetchDepthMap(
  imageData: ImageData,
  onProgress?: (status: string) => void
): Promise<{ depthMap: Float32Array; width: number; height: number } | null> {
  // In local development, use a simple gradient-based fallback
  if (isLocalDevelopment()) {
    onProgress?.('Local mode: Generating depth estimate...');
    
    // Use async chunked processing to avoid blocking
    const result = await generateLocalDepthMapAsync(imageData, onProgress);
    
    onProgress?.('Complete!');
    return result;
  }
  
  try {
    onProgress?.('Preparing image...');
    
    // Resize for API efficiency
    const { resized } = resizeImageForAPI(imageData, 768);
    const imageBase64 = imageDataToBase64(resized);
    
    onProgress?.('Analyzing depth with AI...');
    
    // Helper function to make the API call with retry support
    const callDepthAPI = async (predictionId?: string): Promise<{ success: boolean; depthMapUrl?: string; predictionId?: string; message?: string }> => {
      const response = await fetch('/api/depth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(predictionId ? { predictionId } : { image: imageBase64 }),
      });
      
      if (!response.ok && response.status !== 202) {
        let errorMessage = 'Depth estimation failed';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.message || errorMessage;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }
      
      return response.json();
    };
    
    // Initial request
    let result = await callDepthAPI();
    
    // If the model is still warming up, retry with exponential backoff
    let retryCount = 0;
    const maxRetries = 6;  // More retries for cold starts
    while (!result.success && result.predictionId && retryCount < maxRetries) {
      retryCount++;
      const waitTime = Math.min(5000 * retryCount, 15000);  // 5s, 10s, 15s, 15s, 15s, 15s
      onProgress?.(`AI model warming up... (attempt ${retryCount + 1}, waiting ${waitTime/1000}s)`);
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      result = await callDepthAPI(result.predictionId);
    }
    
    if (!result.success || !result.depthMapUrl) {
      throw new Error(result.message || 'No depth map returned from API');
    }
    
    onProgress?.('Processing depth map...');
    
    console.log('📷 Depth map URL from Replicate:', result.depthMapUrl);
    
    // Fetch the depth map image from Replicate
    const depthImage = await loadImageFromUrl(result.depthMapUrl);
    
    console.log('📷 Depth image loaded:', depthImage.width, 'x', depthImage.height);
    
    // Convert to ImageData at original resolution
    const depthImageData = imageToImageData(depthImage, imageData.width, imageData.height);
    
    console.log('📷 Depth ImageData created:', depthImageData.width, 'x', depthImageData.height);
    
    // Check depth values in the image
    const samplePixels = [];
    for (let i = 0; i < 5; i++) {
      const idx = Math.floor(Math.random() * depthImageData.width * depthImageData.height) * 4;
      samplePixels.push({
        r: depthImageData.data[idx],
        g: depthImageData.data[idx + 1],
        b: depthImageData.data[idx + 2],
      });
    }
    console.log('📷 Sample depth pixels:', samplePixels);
    
    // Normalize and apply bilateral filtering
    const processed = processDepthMap(depthImageData);
    
    // Check processed depth values
    let minDepth = Infinity, maxDepth = -Infinity;
    for (let i = 0; i < processed.length; i++) {
      minDepth = Math.min(minDepth, processed[i]);
      maxDepth = Math.max(maxDepth, processed[i]);
    }
    console.log('📷 Processed depth range:', minDepth, 'to', maxDepth);
    
    return {
      depthMap: processed,
      width: imageData.width,
      height: imageData.height,
    };
    
  } catch (error) {
    console.error('Depth estimation error:', error);
    throw error;
  }
}

/**
 * Process depth map: normalize and apply edge-preserving smoothing
 * MiDaS can output either grayscale or colorized depth maps
 * For colorized (like purple-orange), we convert to luminance first
 */
function processDepthMap(depthData: ImageData): Float32Array {
  const { width, height, data } = depthData;
  const depthValues = new Float32Array(width * height);
  
  // First, check if the image is grayscale or colorized
  // by comparing R, G, B values at a few sample points
  let isColorized = false;
  for (let i = 0; i < Math.min(100, width * height); i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // If R, G, B differ significantly, it's colorized
    if (Math.abs(r - g) > 10 || Math.abs(g - b) > 10 || Math.abs(r - b) > 10) {
      isColorized = true;
      break;
    }
  }
  
  console.log('📷 Depth map type:', isColorized ? 'colorized' : 'grayscale');
  
  // Extract depth values and find min/max
  let min = Infinity;
  let max = -Infinity;
  
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    
    let val: number;
    if (isColorized) {
      // For colorized depth maps (like plasma/viridis colormap):
      // Purple/blue = far (low depth), Orange/yellow = near (high depth)
      // Use a weighted conversion that emphasizes the red channel for "nearness"
      // and blue for "farness"
      val = r * 0.5 + g * 0.25 - b * 0.25 + 128; // Shift to positive range
    } else {
      // Grayscale - just use any channel
      val = r;
    }
    
    depthValues[i] = val;
    min = Math.min(min, val);
    max = Math.max(max, val);
  }
  
  console.log('📷 Raw depth range:', min, 'to', max);
  
  const range = max - min || 1;
  
  // Normalize to 0-1 (0 = far, 1 = near)
  for (let i = 0; i < width * height; i++) {
    depthValues[i] = (depthValues[i] - min) / range;
  }
  
  // TODO: Apply smoothing only for high-res images (currently disabled for performance)
  // For now, return the raw normalized depth map
  // The guided filter was too slow (O(n²) per pixel)
  
  return depthValues;
}

/**
 * Get depth value at specific pixel coordinate
 * Useful for click-to-focus functionality
 */
export function getDepthAtPoint(
  depthMap: Float32Array,
  width: number,
  x: number,
  y: number
): number {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const height = Math.floor(depthMap.length / width);
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  return depthMap[py * width + px];
}

/**
 * Convert Float32Array depth map to ImageData for visualization
 */
export function depthMapToImageData(
  depthMap: Float32Array,
  width: number,
  height: number,
  colorize: boolean = true
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const depth = depthMap[i];
    
    if (colorize) {
      // Blue (far) to Red (near) gradient
      const r = Math.round(depth * 255);
      const g = Math.round((1 - Math.abs(depth - 0.5) * 2) * 100);
      const b = Math.round((1 - depth) * 255);
      
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
    } else {
      // Grayscale
      const val = Math.round(depth * 255);
      data[i * 4] = val;
      data[i * 4 + 1] = val;
      data[i * 4 + 2] = val;
    }
    data[i * 4 + 3] = 255;
  }
  
  return new ImageData(data, width, height);
}

/**
 * Apply depth dilation to prevent background bleeding at edges
 * Expands foreground (high depth) values into neighboring pixels
 */
export function dilateDepthMap(
  depthMap: Float32Array,
  width: number,
  height: number,
  radius: number = 2
): Float32Array {
  const result = new Float32Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxDepth = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            maxDepth = Math.max(maxDepth, depthMap[ny * width + nx]);
          }
        }
      }
      
      result[y * width + x] = maxDepth;
    }
  }
  
  return result;
}
