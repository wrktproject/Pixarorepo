/**
 * Photo Library Component
 * Displays thumbnail grid of uploaded photos with selection
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { setCurrentPhoto, removePhoto } from '../store';
import './PhotoLibrary.css';

export const PhotoLibrary: React.FC = () => {
  const dispatch = useDispatch();
  const { photos, currentPhotoId } = useSelector((state: RootState) => state.library);

  if (photos.length === 0) {
    return null;
  }

  const handlePhotoSelect = (photoId: string) => {
    dispatch(setCurrentPhoto(photoId));
  };

  const handlePhotoRemove = (photoId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm('Remove this photo from the library?')) {
      dispatch(removePhoto(photoId));
    }
  };

  return (
    <div className="photo-library" role="region" aria-label="Photo library">
      <div className="photo-library__header">
        <h2 className="photo-library__title">Photos ({photos.length})</h2>
      </div>
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
    </div>
  );
};
