/**
 * Image Upload Container
 * Example integration of FileUploader with image loading pipeline
 */

import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { FileUploader } from './FileUploader';
import { loadImage } from '../utils/imageLoader';
import { setImageLoading, setOriginalImage, setMetadata, addPhoto } from '../store';
import { PixaroError } from '../types/errors';
import { generateThumbnail } from '../utils/thumbnailGenerator';
import { createInitialAdjustmentState } from '../store/initialState';
import { downscaleImageData } from '../utils/imageDownscaling';
import type { ProcessedImage } from '../types/image';

export const ImageUploadContainer: React.FC = () => {
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      dispatch(setImageLoading(true));

      try {
        // Load the image (handles both standard and RAW formats)
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

        // Add photo to library with initial adjustments
        dispatch(addPhoto({
          id: photoId,
          original: image,
          preview,
          metadata,
          thumbnail,
          adjustments: createInitialAdjustmentState(),
        }));

        // Also update the current image state for backward compatibility
        dispatch(setOriginalImage(image));
        dispatch(setMetadata(metadata));

        console.log('Image loaded successfully:', {
          id: photoId,
          width: image.width,
          height: image.height,
          format: metadata.format,
        });
      } catch (err) {
        console.error('Failed to load image:', err);

        if (err instanceof PixaroError) {
          setError(err.userMessage);
        } else {
          setError('An unexpected error occurred while loading the image.');
        }

        dispatch(setImageLoading(false));
      }
    },
    [dispatch]
  );

  return (
    <div>
      <FileUploader onFileSelect={handleFileSelect} />
      {error && (
        <div style={{ marginTop: '16px', color: '#f87171', textAlign: 'center' }}>
          {error}
        </div>
      )}
    </div>
  );
};
