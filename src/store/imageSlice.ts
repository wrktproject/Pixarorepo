/**
 * Image Slice
 * Manages original and current image state with undo support for destructive edits
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ImageState, ProcessedImage, ImageMetadata } from '../types/store';

// Extended state to include image history for destructive edits (like content-aware fill)
interface ExtendedImageState extends ImageState {
  imageHistory: ProcessedImage[];
  maxImageHistory: number;
}

const initialState: ExtendedImageState = {
  original: null,
  preview: null,
  current: null,
  metadata: null,
  isLoading: false,
  imageHistory: [],
  maxImageHistory: 20, // Limit to prevent memory issues
};

const imageSlice = createSlice({
  name: 'image',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setOriginalImage: (state, action: PayloadAction<ProcessedImage>) => {
      state.original = action.payload;
      state.current = action.payload;
      state.isLoading = false;
      // Clear image history when new image is loaded
      state.imageHistory = [];
    },
    setPreviewImage: (state, action: PayloadAction<ProcessedImage>) => {
      state.preview = action.payload;
    },
    setCurrentImage: (state, action: PayloadAction<ProcessedImage>) => {
      state.current = action.payload;
    },
    /**
     * Set current image and push previous to history (for undoable destructive edits)
     */
    setCurrentImageWithHistory: (state, action: PayloadAction<ProcessedImage>) => {
      // Push current image to history before replacing
      if (state.current) {
        state.imageHistory.push(state.current);
        // Limit history size
        if (state.imageHistory.length > state.maxImageHistory) {
          state.imageHistory.shift();
        }
      }
      state.current = action.payload;
    },
    /**
     * Undo last destructive image edit
     */
    undoImageEdit: (state) => {
      if (state.imageHistory.length > 0) {
        const previousImage = state.imageHistory.pop();
        if (previousImage) {
          state.current = previousImage;
        }
      }
    },
    /**
     * Get the number of undoable image edits
     */
    setMetadata: (state, action: PayloadAction<ImageMetadata>) => {
      state.metadata = action.payload;
    },
    clearImage: (state) => {
      state.original = null;
      state.preview = null;
      state.current = null;
      state.metadata = null;
      state.isLoading = false;
      state.imageHistory = [];
    },
  },
});

export const {
  setLoading,
  setOriginalImage,
  setPreviewImage,
  setCurrentImage,
  setCurrentImageWithHistory,
  undoImageEdit,
  setMetadata,
  clearImage,
} = imageSlice.actions;

// Selector to get image history count
export const selectImageHistoryCount = (state: { image: ExtendedImageState }) => 
  state.image.imageHistory.length;

export default imageSlice.reducer;
