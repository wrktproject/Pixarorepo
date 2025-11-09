/**
 * Preset Initialization
 * Loads built-in presets and custom presets on app initialization
 */

import type { AppDispatch } from '../store';
import { setBuiltInPresets, loadCustomPresets } from '../store/presetSlice';
import { builtInPresets } from '../data/builtInPresets';

/**
 * Initialize presets on app startup
 * Loads built-in presets and restores custom presets from localStorage
 * 
 * @param dispatch - Redux dispatch function
 */
export const initializePresets = (dispatch: AppDispatch): void => {
  // Load built-in presets
  dispatch(setBuiltInPresets(builtInPresets));
  
  // Load custom presets from localStorage
  dispatch(loadCustomPresets());
};
