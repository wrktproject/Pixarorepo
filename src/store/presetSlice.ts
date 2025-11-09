/**
 * Preset Slice
 * Manages built-in and custom presets with browser storage integration
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PresetState, Preset } from '../types/store';
import type { AdjustmentState } from '../types/adjustments';

const STORAGE_KEY = 'pixaro_custom_presets';

// Helper to load custom presets from localStorage
const loadCustomPresetsFromStorage = (): Preset[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load custom presets from storage:', error);
  }
  return [];
};

// Helper to save custom presets to localStorage
const saveCustomPresetsToStorage = (presets: Preset[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save custom presets to storage:', error);
    
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('Storage quota exceeded. Unable to save preset.');
      // In a production app, you might want to dispatch an action to show a user-facing error
      throw new Error('Storage quota exceeded. Please delete some custom presets to free up space.');
    }
    
    throw error;
  }
};

const initialState: PresetState = {
  builtIn: [],
  custom: loadCustomPresetsFromStorage(),
  isLoading: false,
};

const presetSlice = createSlice({
  name: 'presets',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    // Set built-in presets (loaded once at app initialization)
    setBuiltInPresets: (state, action: PayloadAction<Preset[]>) => {
      state.builtIn = action.payload;
    },

    // Save a new custom preset
    saveCustomPreset: (
      state,
      action: PayloadAction<{ name: string; adjustments: AdjustmentState }>
    ) => {
      const newPreset: Preset = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: action.payload.name,
        adjustments: action.payload.adjustments,
        isBuiltIn: false,
      };

      state.custom.push(newPreset);
      
      try {
        saveCustomPresetsToStorage(state.custom);
      } catch (error) {
        // Rollback on storage error
        state.custom.pop();
        throw error;
      }
    },

    // Delete a custom preset
    deleteCustomPreset: (state, action: PayloadAction<string>) => {
      state.custom = state.custom.filter(
        (preset) => preset.id !== action.payload
      );
      saveCustomPresetsToStorage(state.custom);
    },

    // Update a custom preset
    updateCustomPreset: (
      state,
      action: PayloadAction<{ id: string; name: string; adjustments: AdjustmentState }>
    ) => {
      const index = state.custom.findIndex(
        (preset) => preset.id === action.payload.id
      );
      if (index !== -1) {
        state.custom[index] = {
          ...state.custom[index],
          name: action.payload.name,
          adjustments: action.payload.adjustments,
        };
        saveCustomPresetsToStorage(state.custom);
      }
    },

    // Load custom presets from storage (useful for refresh)
    loadCustomPresets: (state) => {
      state.custom = loadCustomPresetsFromStorage();
    },

    // Clear all custom presets
    clearCustomPresets: (state) => {
      state.custom = [];
      saveCustomPresetsToStorage([]);
    },
  },
});

export const {
  setLoading,
  setBuiltInPresets,
  saveCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
  loadCustomPresets,
  clearCustomPresets,
} = presetSlice.actions;

export default presetSlice.reducer;
