/**
 * Preset Utilities
 * Helper functions for applying and managing presets
 */

import type { Preset } from '../types/store';
import type { AdjustmentState } from '../types/adjustments';
import type { AppDispatch } from '../store';
import { setAllAdjustments } from '../store/adjustmentsSlice';
import { addToHistory } from '../store/historySlice';

/**
 * Apply a preset to the current image
 * This function updates the adjustments state and adds the change to history
 * 
 * @param preset - The preset to apply
 * @param dispatch - Redux dispatch function
 * @param currentAdjustments - Current adjustment state (for history)
 */
export const applyPreset = (
  preset: Preset,
  dispatch: AppDispatch,
  currentAdjustments: AdjustmentState
): void => {
  // Add current state to history before applying preset
  dispatch(addToHistory(currentAdjustments));

  // Apply preset adjustments
  // Note: We preserve removals from current state as presets don't include removal operations
  const newAdjustments: AdjustmentState = {
    ...preset.adjustments,
    removals: currentAdjustments.removals, // Preserve existing removal operations
  };

  dispatch(setAllAdjustments(newAdjustments));
};

/**
 * Create a preset from current adjustments
 * Excludes removal operations and crop/straighten as these are image-specific
 * 
 * @param name - Name for the new preset
 * @param adjustments - Current adjustment state
 * @returns Preset object ready to be saved
 */
export const createPresetFromAdjustments = (
  name: string,
  adjustments: AdjustmentState
): Omit<Preset, 'id' | 'isBuiltIn'> => {
  return {
    name,
    adjustments: {
      ...adjustments,
      // Reset image-specific adjustments
      crop: null,
      straighten: 0,
      removals: [],
    },
  };
};

/**
 * Validate preset name
 * 
 * @param name - Preset name to validate
 * @returns Error message if invalid, null if valid
 */
export const validatePresetName = (name: string): string | null => {
  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    return 'Preset name cannot be empty';
  }
  
  if (trimmedName.length > 50) {
    return 'Preset name must be 50 characters or less';
  }
  
  return null;
};

/**
 * Check if a preset name already exists
 * 
 * @param name - Preset name to check
 * @param existingPresets - Array of existing presets
 * @returns True if name exists, false otherwise
 */
export const presetNameExists = (
  name: string,
  existingPresets: Preset[]
): boolean => {
  const trimmedName = name.trim().toLowerCase();
  return existingPresets.some(
    (preset) => preset.name.toLowerCase() === trimmedName
  );
};
