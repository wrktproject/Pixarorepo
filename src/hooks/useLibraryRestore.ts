/**
 * Library Restore Hook
 * Restores saved library state and images on app load
 * Handles session recovery similar to Lightroom's catalog restoration
 */

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  addPhoto,
  setCurrentPhoto,
  setZoom,
  setPan,
  setActiveTool,
} from '../store';
import {
  loadLibraryFromLocalStorage,
  loadSessionState,
  loadImageFromIndexedDB,
  clearSessionState,
  initIndexedDB,
} from '../utils/persistence';

export interface RestoreStatus {
  isRestoring: boolean;
  photosRestored: number;
  totalPhotos: number;
  error: string | null;
}

/**
 * Hook to restore library and session state on app load
 * 
 * Returns restoration status for UI feedback
 * 
 * Usage:
 * ```
 * const { isRestoring, photosRestored, totalPhotos, error } = useLibraryRestore();
 * ```
 */
export function useLibraryRestore(): RestoreStatus {
  const dispatch = useDispatch();
  const hasRestoredRef = useRef(false);
  
  const [status, setStatus] = useState<RestoreStatus>({
    isRestoring: false,
    photosRestored: 0,
    totalPhotos: 0,
    error: null,
  });

  useEffect(() => {
    // Only run once on mount
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const restore = async () => {
      try {
        setStatus({
          isRestoring: true,
          photosRestored: 0,
          totalPhotos: 0,
          error: null,
        });

        // Initialize IndexedDB
        await initIndexedDB();
        console.log('📂 IndexedDB initialized');

        // Load library metadata from LocalStorage
        const savedLibrary = loadLibraryFromLocalStorage();
        
        if (!savedLibrary || savedLibrary.photos.length === 0) {
          console.log('📁 No saved library found, starting fresh');
          setStatus({
            isRestoring: false,
            photosRestored: 0,
            totalPhotos: 0,
            error: null,
          });
          return;
        }

        console.log('📂 Restoring library:', {
          photoCount: savedLibrary.photos.length,
          savedAt: new Date(savedLibrary.savedAt).toLocaleString(),
        });

        setStatus(prev => ({
          ...prev,
          totalPhotos: savedLibrary.photos.length,
        }));

        // Restore each photo
        let restoredCount = 0;
        for (const photoMeta of savedLibrary.photos) {
          try {
            // Load image data from IndexedDB
            const imageData = await loadImageFromIndexedDB(photoMeta.id);
            
            if (!imageData) {
              console.warn(`Image data not found for photo ${photoMeta.id}, skipping`);
              continue;
            }

            // Add photo to library
            dispatch(addPhoto({
              id: photoMeta.id,
              original: imageData.original,
              preview: imageData.preview,
              metadata: photoMeta.metadata,
              thumbnail: photoMeta.thumbnail,
              adjustments: photoMeta.adjustments,
            }));

            restoredCount++;
            setStatus(prev => ({
              ...prev,
              photosRestored: restoredCount,
            }));

            console.log(`✅ Restored photo ${restoredCount}/${savedLibrary.photos.length}:`, photoMeta.id);
          } catch (error) {
            console.error(`Failed to restore photo ${photoMeta.id}:`, error);
            // Continue with other photos
          }
        }

        // Restore current photo selection
        if (savedLibrary.currentPhotoId) {
          dispatch(setCurrentPhoto(savedLibrary.currentPhotoId));
        }

        // Restore session state (zoom, pan, active tool)
        const session = loadSessionState();
        if (session) {
          console.log('🔄 Restoring session state:', session);
          
          if (session.zoom) {
            dispatch(setZoom(session.zoom));
          }
          
          if (session.pan) {
            dispatch(setPan(session.pan));
          }
          
          if (session.activeTool) {
            dispatch(setActiveTool(session.activeTool as any));
          }

          // Clear session after successful restore
          clearSessionState();
        }

        console.log(`✅ Library restored: ${restoredCount}/${savedLibrary.photos.length} photos`);
        
        setStatus({
          isRestoring: false,
          photosRestored: restoredCount,
          totalPhotos: savedLibrary.photos.length,
          error: null,
        });

      } catch (error) {
        console.error('❌ Failed to restore library:', error);
        setStatus({
          isRestoring: false,
          photosRestored: 0,
          totalPhotos: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    restore();
  }, [dispatch]);

  return status;
}

