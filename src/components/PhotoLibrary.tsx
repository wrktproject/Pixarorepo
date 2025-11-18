/**
 * Photo Library Component
 * Displays thumbnail grid of uploaded photos with selection
 */

import React, { useCallback, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCurrentPhoto, removePhoto, addPhoto, setImageLoading } from '../store';
import { loadImage } from '../utils/imageLoader';
import { generateThumbnail } from '../utils/thumbnailGenerator';
import { createInitialAdjustmentState } from '../store/initialState';
import { downscaleImageData } from '../utils/imageDownscaling';
import { saveImageToIndexedDB, deleteImageFromIndexedDB } from '../utils/persistence';
import type { ProcessedImage } from '../types/image';
import { PixaroError } from '../types/errors';
import './PhotoLibrary.css';

export const PhotoLibrary: React.FC = () => {
  const dispatch = useDispatch();
  const { photos, currentPhotoId } = useSelector((state: RootState) => state.library);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handlePhotoSelect = (photoId: string) => {
    dispatch(setCurrentPhoto(photoId));
  };

  const handlePhotoRemove = async (photoId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Remove this photo from the library?')) {
      // Remove from Redux store
      dispatch(removePhoto(photoId));
      
      // Remove from IndexedDB
      try {
        await deleteImageFromIndexedDB(photoId);
        console.log('🗑️ Image deleted from IndexedDB:', photoId);
      } catch (error) {
        console.warn('Failed to delete image from IndexedDB:', error);
      }
    }
  };

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsImporting(true);
      dispatch(setImageLoading(true));

      try {
        // Process each selected file
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          try {
            // Load the image
            const { image, metadata } = await loadImage(file);

            // Generate unique ID for the photo
            const photoId = `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Generate thumbnail
            const thumbnail = generateThumbnail(image);

            // Generate preview (downscaled version)
            const previewResult = downscaleImageData(image.data, { maxSize: 2048, quality: 'high' });
            const preview: ProcessedImage = {
              data: previewResult.imageData,
              width: previewResult.previewWidth,
              height: previewResult.previewHeight,
              colorSpace: image.colorSpace,
            };

            // Add photo to library with its own independent adjustments
            dispatch(addPhoto({
              id: photoId,
              original: image,
              preview,
              metadata,
              thumbnail,
              adjustments: createInitialAdjustmentState(), // Each photo gets its own adjustments
            }));

            // Save image data to IndexedDB for persistence
            try {
              await saveImageToIndexedDB(photoId, image, preview);
              console.log('📁 Image saved to IndexedDB:', photoId);
            } catch (dbError) {
              console.warn('Failed to save image to IndexedDB:', dbError);
              // Continue anyway - photo is still in memory
            }

            console.log('Photo imported:', {
              id: photoId,
              width: image.width,
              height: image.height,
              format: metadata.format,
            });
          } catch (err) {
            console.error(`Failed to load image ${file.name}:`, err);
            if (err instanceof PixaroError) {
              alert(`Error loading ${file.name}: ${err.userMessage}`);
            }
          }
        }
      } finally {
        setIsImporting(false);
        dispatch(setImageLoading(false));
        // Reset input to allow selecting the same files again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [dispatch]
  );

  return (
    <div className="photo-library" role="region" aria-label="Photo library">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/tiff,.jpg,.jpeg,.png,.tiff,.tif,.cr2,.nef,.arw,.dng"
        onChange={handleFileSelect}
        multiple
        style={{ display: 'none' }}
        aria-label="Import photos"
      />
      <div className="photo-library__header">
        <h2 className="photo-library__title">Photos ({photos.length})</h2>
        <button
          className="photo-library__import-btn"
          onClick={handleImportClick}
          disabled={isImporting}
          title="Import more photos"
          aria-label="Import more photos"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {isImporting ? 'Importing...' : 'Import'}
        </button>
      </div>
      
      {photos.length === 0 ? (
        <div className="photo-library__empty" role="status" aria-label="No photos in library">
          <p>No photos yet. Click Import to get started.</p>
        </div>
      ) : (
        <div className="photo-library__grid" role="list">
          {photos.map((photo) => {
          const isActive = photo.id === currentPhotoId;
          
          return (
            <div
              key={photo.id}
              className={`photo-library__item ${isActive ? 'photo-library__item--active' : ''}`}
              onClick={() => handlePhotoSelect(photo.id)}
              role="listitem"
              tabIndex={0}
              aria-label={`Photo ${photo.id}${isActive ? ' (current)' : ''}`}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePhotoSelect(photo.id);
                }
              }}
            >
              <div className="photo-library__thumbnail-wrapper">
                <img
                  src={photo.thumbnail}
                  alt={`Thumbnail for photo ${photo.id}`}
                  className="photo-library__thumbnail"
                />
                {isActive && (
                  <div className="photo-library__active-indicator" aria-hidden="true">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
                <button
                  className="photo-library__remove-btn"
                  onClick={(e) => handlePhotoRemove(photo.id, e)}
                  aria-label={`Remove photo ${photo.id}`}
                  title="Remove photo"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="photo-library__info">
                <span className="photo-library__dimensions">
                  {photo.metadata.width} × {photo.metadata.height}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
