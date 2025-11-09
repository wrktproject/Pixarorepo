/**
 * Library Slice
 * Manages multiple photos and their associated adjustment states
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ProcessedImage, ImageMetadata } from '../types/image';
import type { AdjustmentState } from '../types/adjustments';

export interface PhotoEntry {
  id: string;
  original: ProcessedImage;
  preview: ProcessedImage | null;
  metadata: ImageMetadata;
  adjustments: AdjustmentState;
  thumbnail: string; // Data URL for thumbnail
  uploadedAt: number;
}

export interface LibraryState {
  photos: PhotoEntry[];
  currentPhotoId: string | null;
}

const initialState: LibraryState = {
  photos: [],
  currentPhotoId: null,
};

const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    addPhoto: (
      state,
      action: PayloadAction<{
        id: string;
        original: ProcessedImage;
        preview: ProcessedImage | null;
        metadata: ImageMetadata;
        thumbnail: string;
        adjustments: AdjustmentState;
      }>
    ) => {
      const newPhoto: PhotoEntry = {
        ...action.payload,
        uploadedAt: Date.now(),
      };
      state.photos.push(newPhoto);
      
      // Set as current if it's the first photo
      if (state.photos.length === 1) {
        state.currentPhotoId = newPhoto.id;
      }
    },
    
    setCurrentPhoto: (state, action: PayloadAction<string>) => {
      const photoExists = state.photos.some(p => p.id === action.payload);
      if (photoExists) {
        state.currentPhotoId = action.payload;
      }
    },
    
    updatePhotoAdjustments: (
      state,
      action: PayloadAction<{ id: string; adjustments: AdjustmentState }>
    ) => {
      const photo = state.photos.find(p => p.id === action.payload.id);
      if (photo) {
        photo.adjustments = action.payload.adjustments;
      }
    },
    
    removePhoto: (state, action: PayloadAction<string>) => {
      const index = state.photos.findIndex(p => p.id === action.payload);
      if (index !== -1) {
        state.photos.splice(index, 1);
        
        // Update current photo if the removed photo was current
        if (state.currentPhotoId === action.payload) {
          if (state.photos.length > 0) {
            // Select the previous photo, or the first one if we removed the first
            const newIndex = Math.max(0, index - 1);
            state.currentPhotoId = state.photos[newIndex]?.id || null;
          } else {
            state.currentPhotoId = null;
          }
        }
      }
    },
    
    clearLibrary: (state) => {
      state.photos = [];
      state.currentPhotoId = null;
    },
  },
});

export const {
  addPhoto,
  setCurrentPhoto,
  updatePhotoAdjustments,
  removePhoto,
  clearLibrary,
} = librarySlice.actions;

export default librarySlice.reducer;
