/**
 * Persistence Layer
 * Handles saving/loading app state to LocalStorage and IndexedDB
 * Architecture similar to Lightroom's catalog system
 */

import type { LibraryState, PhotoEntry } from '../store/librarySlice';
import type { ProcessedImage } from '../types/image';

// Version for migration support
const STORAGE_VERSION = 1;
const STORAGE_KEY_PREFIX = 'pixaro_v' + STORAGE_VERSION;

// Keys for different storage types
const KEYS = {
  LIBRARY: `${STORAGE_KEY_PREFIX}_library`,
  SESSION: `${STORAGE_KEY_PREFIX}_session`,
  SETTINGS: `${STORAGE_KEY_PREFIX}_settings`,
  VERSION: `${STORAGE_KEY_PREFIX}_version`,
};

// IndexedDB configuration
const DB_NAME = 'PixaroDB';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';

/**
 * Initialize IndexedDB for storing large image data
 */
export async function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store for images if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        const store = db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };
  });
}

/**
 * Save image data to IndexedDB
 */
export async function saveImageToIndexedDB(
  id: string,
  original: ProcessedImage,
  preview: ProcessedImage | null
): Promise<void> {
  const db = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);

    const data = {
      id,
      original: {
        data: original.data,
        width: original.width,
        height: original.height,
        colorSpace: original.colorSpace,
      },
      preview: preview ? {
        data: preview.data,
        width: preview.width,
        height: preview.height,
        colorSpace: preview.colorSpace,
      } : null,
      uploadedAt: Date.now(),
    };

    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load image data from IndexedDB
 */
export async function loadImageFromIndexedDB(id: string): Promise<{
  original: ProcessedImage;
  preview: ProcessedImage | null;
} | null> {
  const db = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readonly');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.get(id);

    request.onsuccess = () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }

      resolve({
        original: result.original,
        preview: result.preview,
      });
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete image data from IndexedDB
 */
export async function deleteImageFromIndexedDB(id: string): Promise<void> {
  const db = await initIndexedDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_IMAGES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGES);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Library persistence - stores photo metadata and adjustments (NOT pixel data)
 * This is lightweight and can be stored in LocalStorage
 */
export interface SerializedLibrary {
  photos: Array<{
    id: string;
    adjustments: PhotoEntry['adjustments'];
    metadata: PhotoEntry['metadata'];
    thumbnail: string; // Data URL for thumbnails
    uploadedAt: number;
  }>;
  currentPhotoId: string | null;
  version: number;
  savedAt: number;
}

/**
 * Save library to LocalStorage (metadata + adjustments only, no images)
 */
export function saveLibraryToLocalStorage(library: LibraryState): boolean {
  try {
    const serialized: SerializedLibrary = {
      photos: library.photos.map(photo => ({
        id: photo.id,
        adjustments: photo.adjustments,
        metadata: photo.metadata,
        thumbnail: photo.thumbnail,
        uploadedAt: photo.uploadedAt,
      })),
      currentPhotoId: library.currentPhotoId,
      version: STORAGE_VERSION,
      savedAt: Date.now(),
    };

    localStorage.setItem(KEYS.LIBRARY, JSON.stringify(serialized));
    console.log('📁 Library saved to LocalStorage:', {
      photoCount: serialized.photos.length,
      size: JSON.stringify(serialized).length + ' bytes',
    });
    
    return true;
  } catch (error) {
    console.error('Failed to save library to LocalStorage:', error);
    
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded. Consider clearing old data.');
    }
    
    return false;
  }
}

/**
 * Load library from LocalStorage
 */
export function loadLibraryFromLocalStorage(): SerializedLibrary | null {
  try {
    const data = localStorage.getItem(KEYS.LIBRARY);
    if (!data) return null;

    const parsed = JSON.parse(data) as SerializedLibrary;
    
    // Version check
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('Library version mismatch, migration may be needed');
      // TODO: Add migration logic if needed
    }

    console.log('📂 Library loaded from LocalStorage:', {
      photoCount: parsed.photos.length,
      savedAt: new Date(parsed.savedAt).toLocaleString(),
    });

    return parsed;
  } catch (error) {
    console.error('Failed to load library from LocalStorage:', error);
    return null;
  }
}

/**
 * Session recovery - saves temporary editing state
 */
export interface SessionState {
  currentPhotoId: string | null;
  activeTool: string | null;
  zoom: number;
  pan: { x: number; y: number };
  timestamp: number;
}

/**
 * Save session state for crash recovery
 */
export function saveSessionState(state: Partial<SessionState>): void {
  try {
    const existing = loadSessionState() || {};
    const merged: SessionState = {
      ...existing,
      ...state,
      timestamp: Date.now(),
    } as SessionState;

    localStorage.setItem(KEYS.SESSION, JSON.stringify(merged));
  } catch (error) {
    console.error('Failed to save session state:', error);
  }
}

/**
 * Load session state for recovery
 */
export function loadSessionState(): SessionState | null {
  try {
    const data = localStorage.getItem(KEYS.SESSION);
    if (!data) return null;

    const parsed = JSON.parse(data) as SessionState;
    
    // Only restore if session is less than 1 hour old
    const age = Date.now() - parsed.timestamp;
    if (age > 60 * 60 * 1000) {
      console.log('Session too old, not restoring');
      clearSessionState();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load session state:', error);
    return null;
  }
}

/**
 * Clear session state (called after successful recovery or manual close)
 */
export function clearSessionState(): void {
  localStorage.removeItem(KEYS.SESSION);
}

/**
 * Clear all app data (for debugging or reset)
 */
export async function clearAllAppData(): Promise<void> {
  // Clear LocalStorage
  Object.values(KEYS).forEach(key => {
    localStorage.removeItem(key);
  });

  // Clear IndexedDB
  const db = await initIndexedDB();
  const transaction = db.transaction([STORE_IMAGES], 'readwrite');
  const store = transaction.objectStore(STORE_IMAGES);
  store.clear();

  console.log('🗑️ All app data cleared');
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  localStorageUsed: number;
  localStorageQuota: number;
  indexedDBUsed: number;
  photoCount: number;
}> {
  // LocalStorage size
  let localStorageUsed = 0;
  for (const key in localStorage) {
    if (key.startsWith(STORAGE_KEY_PREFIX)) {
      localStorageUsed += localStorage[key].length;
    }
  }

  // IndexedDB size (approximate)
  const db = await initIndexedDB();
  const transaction = db.transaction([STORE_IMAGES], 'readonly');
  const store = transaction.objectStore(STORE_IMAGES);
  
  const countRequest = store.count();
  const photoCount = await new Promise<number>((resolve) => {
    countRequest.onsuccess = () => resolve(countRequest.result);
  });

  // Estimate: ~5MB per photo average
  const indexedDBUsed = photoCount * 5 * 1024 * 1024;

  return {
    localStorageUsed,
    localStorageQuota: 5 * 1024 * 1024, // ~5MB typical quota
    indexedDBUsed,
    photoCount,
  };
}

