/**
 * Image Slice
 * Manages original and current image state
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ImageState, ProcessedImage, ImageMetadata } from '../types/store';

const initialState: ImageState = {
  original: null,
  preview: null,
  current: null,
  metadata: null,
  isLoading: false,
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
    },
    setPreviewImage: (state, action: PayloadAction<ProcessedImage>) => {
      state.preview = action.payload;
    },
    setCurrentImage: (state, action: PayloadAction<ProcessedImage>) => {
      state.current = action.payload;
    },
    setMetadata: (state, action: PayloadAction<ImageMetadata>) => {
      state.metadata = action.payload;
    },
    clearImage: (state) => {
      state.original = null;
      state.preview = null;
      state.current = null;
      state.metadata = null;
      state.isLoading = false;
    },
  },
});

export const {
  setLoading,
  setOriginalImage,
  setPreviewImage,
  setCurrentImage,
  setMetadata,
  clearImage,
} = imageSlice.actions;

export default imageSlice.reducer;
