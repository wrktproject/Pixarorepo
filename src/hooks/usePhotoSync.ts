/**
 * Photo Sync Hook
 * Synchronizes adjustments between the current photo and the library
 */

import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import {
  updatePhotoAdjustments,
  setOriginalImage,
  setCurrentImage,
  setMetadata,
  setAllAdjustments,
  setPresent,
  resetHistory,
} from '../store';
import { setPreviewImage, clearImage } from '../store/imageSlice';

/**
 * Hook to sync adjustments with the library and handle photo switching
 */
export function usePhotoSync() {
  const dispatch = useDispatch();
  const currentPhotoId = useSelector((state: RootState) => state.library.currentPhotoId);
  const photos = useSelector((state: RootState) => state.library.photos);
  const adjustments = useSelector((state: RootState) => state.adjustments);
  const previousPhotoIdRef = useRef<string | null>(null);

  // Sync adjustments to library when they change
  useEffect(() => {
    if (currentPhotoId && previousPhotoIdRef.current === currentPhotoId) {
      // Only update if we're on the same photo (not switching)
      dispatch(updatePhotoAdjustments({
        id: currentPhotoId,
        adjustments,
      }));
    }
  }, [adjustments, currentPhotoId, dispatch]);

  // Handle photo switching and clearing
  useEffect(() => {
    // If no current photo, clear the image state
    if (!currentPhotoId) {
      if (previousPhotoIdRef.current !== null) {
        // We had a photo before but now we don't - clear everything
        console.log('🗑️ No current photo, clearing image state');
        dispatch(clearImage());
      }
      previousPhotoIdRef.current = null;
      return;
    }

    // Check if we're switching to a different photo
    if (previousPhotoIdRef.current !== currentPhotoId) {
      const photo = photos.find(p => p.id === currentPhotoId);
      
      if (photo) {
        // Save current photo's adjustments before switching
        if (previousPhotoIdRef.current) {
          dispatch(updatePhotoAdjustments({
            id: previousPhotoIdRef.current,
            adjustments,
          }));
        }

        console.log('🔄 Switching to photo:', {
          id: photo.id,
          dimensions: `${photo.original.width}x${photo.original.height}`,
          hasCrop: !!photo.adjustments.crop,
          rotation: photo.adjustments.rotation,
        });

        // IMPORTANT: Update adjustments FIRST before loading image
        // This prevents the canvas from rendering the new image with old adjustments
        dispatch(setAllAdjustments(photo.adjustments));
        dispatch(setPresent(photo.adjustments));
        dispatch(resetHistory(photo.adjustments));

        // Then load the new photo's data
        dispatch(setOriginalImage(photo.original));
        if (photo.preview) {
          dispatch(setPreviewImage(photo.preview));
        }
        dispatch(setCurrentImage(photo.original));
        dispatch(setMetadata(photo.metadata));

        // Update the ref
        previousPhotoIdRef.current = currentPhotoId;
      }
    }
  }, [currentPhotoId, photos, adjustments, dispatch]);

  return {
    currentPhotoId,
    hasPhotos: photos.length > 0,
  };
}
