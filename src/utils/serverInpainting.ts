/**
 * Server-side AI Inpainting Client
 * 
 * Calls our backend API which proxies to Replicate.
 * Features:
 * - 5 free AI removals per day
 * - Graceful fallback to local algorithm
 * - Usage tracking with localStorage persistence
 * 
 * NOTE: Only works when deployed (Vercel). In localhost, uses local processing.
 */

// API endpoint - uses relative path for same-origin
const API_ENDPOINT = '/api/inpaint';

// Check if we're in development mode (localhost)
const isDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   window.location.port === '5173');

// Constants
const DAILY_LIMIT = 5;
const STORAGE_KEY = 'pixaro_ai_usage';

interface UsageData {
  count: number;
  date: string; // YYYY-MM-DD format
}

interface InpaintingResult {
  success: boolean;
  imageData?: ImageData;
  error?: string;
  remaining?: number;
  rateLimited?: boolean;
}

// Track remaining uses locally for UI feedback
let cachedRemaining: number | null = null;

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load usage data from localStorage
 */
function loadUsageData(): UsageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as UsageData;
      // Reset if it's a new day
      if (data.date !== getTodayString()) {
        return { count: 0, date: getTodayString() };
      }
      return data;
    }
  } catch (e) {
    console.warn('Failed to load AI usage data:', e);
  }
  return { count: 0, date: getTodayString() };
}

/**
 * Save usage data to localStorage
 */
function saveUsageData(data: UsageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save AI usage data:', e);
  }
}

/**
 * Increment usage count (called after successful AI removal)
 */
export function incrementAIUsage(): void {
  const data = loadUsageData();
  data.count++;
  saveUsageData(data);
  cachedRemaining = Math.max(0, DAILY_LIMIT - data.count);
}

/**
 * Get current AI usage stats
 */
export function getAIUsageStats(): { used: number; remaining: number; limit: number } {
  const data = loadUsageData();
  const remaining = Math.max(0, DAILY_LIMIT - data.count);
  cachedRemaining = remaining;
  return {
    used: data.count,
    remaining,
    limit: DAILY_LIMIT,
  };
}

/**
 * Get cached remaining AI uses
 */
export function getRemainingAIUses(): number | null {
  if (cachedRemaining === null) {
    const stats = getAIUsageStats();
    return stats.remaining;
  }
  return cachedRemaining;
}

/**
 * Check if server inpainting should be attempted
 * Returns false in dev mode or if rate limited
 */
export function isServerInpaintingAvailable(): boolean {
  // Server API only works in production (deployed to Vercel)
  if (isDev) {
    return false;
  }
  // If we've cached that we're rate limited, don't try
  if (cachedRemaining === 0) {
    return false;
  }
  return true;
}

/**
 * Convert ImageData to base64 PNG data URL
 */
async function imageDataToBase64(imageData: ImageData): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Convert mask (Float32Array) to base64 PNG data URL
 * White = areas to inpaint, Black = areas to keep
 */
async function maskToBase64(
  mask: Float32Array,
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  
  for (let i = 0; i < mask.length; i++) {
    const val = mask[i] > 0.5 ? 255 : 0;
    const idx = i * 4;
    imgData.data[idx] = val;     // R
    imgData.data[idx + 1] = val; // G
    imgData.data[idx + 2] = val; // B
    imgData.data[idx + 3] = 255; // A
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Load image from URL to ImageData
 */
async function urlToImageData(url: string, targetWidth: number, targetHeight: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(ctx.getImageData(0, 0, targetWidth, targetHeight));
    };
    img.onerror = () => reject(new Error('Failed to load result image'));
    img.src = url;
  });
}

/**
 * Call the server API for AI inpainting
 */
export async function serverInpaint(
  imageData: ImageData,
  mask: Float32Array,
  onProgress?: (status: string) => void
): Promise<InpaintingResult> {
  try {
    onProgress?.('Preparing image for AI...');
    
    // Convert image and mask to base64
    const imageBase64 = await imageDataToBase64(imageData);
    const maskBase64 = await maskToBase64(mask, imageData.width, imageData.height);
    
    onProgress?.('Sending to AI server...');
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        mask: maskBase64,
      }),
    });
    
    const data = await response.json();
    
    // Handle rate limiting
    if (response.status === 429 || data.error === 'rate_limit') {
      cachedRemaining = 0;
      return {
        success: false,
        error: data.message || 'Daily limit reached',
        rateLimited: true,
        remaining: 0,
      };
    }
    
    // Handle server not configured
    if (response.status === 503) {
      return {
        success: false,
        error: 'AI server not configured',
      };
    }
    
    // Handle other errors
    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.message || 'AI processing failed',
      };
    }
    
    // Update cached remaining
    if (typeof data.remaining === 'number') {
      cachedRemaining = data.remaining;
    }
    
    onProgress?.('Processing AI result...');
    
    // Load the result image
    const resultImageData = await urlToImageData(
      data.imageUrl,
      imageData.width,
      imageData.height
    );
    
    return {
      success: true,
      imageData: resultImageData,
      remaining: data.remaining,
    };
    
  } catch (error) {
    console.error('Server inpainting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Simplified API - returns ImageData or null
 */
export async function tryServerInpaint(
  imageData: ImageData,
  mask: Float32Array,
  onProgress?: (status: string) => void
): Promise<ImageData | null> {
  // In dev mode, skip server and use local processing
  if (isDev) {
    console.log('Dev mode: using local processing (deploy to Vercel for AI)');
    onProgress?.('Using local processing...');
    return null;
  }
  
  // Don't try if we know we're rate limited
  if (cachedRemaining === 0) {
    onProgress?.('AI limit reached, using local processing...');
    return null;
  }
  
  const result = await serverInpaint(imageData, mask, onProgress);
  
  if (result.success && result.imageData) {
    return result.imageData;
  }
  
  if (result.rateLimited) {
    onProgress?.('AI limit reached, using local processing...');
  } else {
    console.warn('Server inpainting failed:', result.error);
    onProgress?.('AI unavailable, using local processing...');
  }
  
  return null;
}

// Legacy functions for backwards compatibility (no longer needed but kept for imports)
export function setReplicateApiKey(_key: string): void {
  // No longer used - server handles API key
  console.log('API key is now managed server-side');
}

export function clearReplicateApiKey(): void {
  // No longer used
}
