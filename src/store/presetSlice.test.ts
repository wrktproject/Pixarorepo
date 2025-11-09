/**
 * Preset Slice Tests
 * Tests for preset save/load/delete operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import presetReducer, {
  saveCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
  loadCustomPresets,
  clearCustomPresets,
  setBuiltInPresets,
} from './presetSlice';
import { createInitialAdjustmentState } from './initialState';
import { Preset } from '../types/store';

const STORAGE_KEY = 'pixaro_custom_presets';

describe('presetSlice', () => {
  // Clear localStorage before and after each test
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('setBuiltInPresets', () => {
    it('should set built-in presets', () => {
      const initialState = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      const builtInPresets: Preset[] = [
        {
          id: 'preset1',
          name: 'Portrait',
          adjustments: createInitialAdjustmentState(),
          isBuiltIn: true,
        },
        {
          id: 'preset2',
          name: 'Landscape',
          adjustments: createInitialAdjustmentState(),
          isBuiltIn: true,
        },
      ];

      const result = presetReducer(
        initialState,
        setBuiltInPresets(builtInPresets)
      );

      expect(result.builtIn.length).toBe(2);
      expect(result.builtIn[0].name).toBe('Portrait');
      expect(result.builtIn[1].name).toBe('Landscape');
    });
  });

  describe('saveCustomPreset', () => {
    it('should save a new custom preset', () => {
      const initialState = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      const adjustments = {
        ...createInitialAdjustmentState(),
        exposure: 2,
        contrast: 30,
      };

      const result = presetReducer(
        initialState,
        saveCustomPreset({ name: 'My Preset', adjustments })
      );

      expect(result.custom.length).toBe(1);
      expect(result.custom[0].name).toBe('My Preset');
      expect(result.custom[0].adjustments.exposure).toBe(2);
      expect(result.custom[0].adjustments.contrast).toBe(30);
      expect(result.custom[0].isBuiltIn).toBe(false);
      expect(result.custom[0].id).toContain('custom_');
    });

    it('should persist custom preset to localStorage', () => {
      const initialState = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      const adjustments = createInitialAdjustmentState();

      presetReducer(
        initialState,
        saveCustomPreset({ name: 'Test Preset', adjustments })
      );

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(1);
      expect(parsed[0].name).toBe('Test Preset');
    });

    it('should add multiple custom presets', () => {
      let state = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      state = presetReducer(
        state,
        saveCustomPreset({
          name: 'Preset 1',
          adjustments: createInitialAdjustmentState(),
        })
      );

      state = presetReducer(
        state,
        saveCustomPreset({
          name: 'Preset 2',
          adjustments: createInitialAdjustmentState(),
        })
      );

      expect(state.custom.length).toBe(2);
      expect(state.custom[0].name).toBe('Preset 1');
      expect(state.custom[1].name).toBe('Preset 2');
    });
  });

  describe('deleteCustomPreset', () => {
    it('should delete a custom preset by id', () => {
      const initialState = {
        builtIn: [],
        custom: [
          {
            id: 'custom_1',
            name: 'Preset 1',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
          {
            id: 'custom_2',
            name: 'Preset 2',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
        ],
        isLoading: false,
      };

      const result = presetReducer(initialState, deleteCustomPreset('custom_1'));

      expect(result.custom.length).toBe(1);
      expect(result.custom[0].id).toBe('custom_2');
    });

    it('should update localStorage after deletion', () => {
      const initialState = {
        builtIn: [],
        custom: [
          {
            id: 'custom_1',
            name: 'Preset 1',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
        ],
        isLoading: false,
      };

      // Save to localStorage first
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState.custom));

      presetReducer(initialState, deleteCustomPreset('custom_1'));

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(0);
    });
  });

  describe('updateCustomPreset', () => {
    it('should update an existing custom preset', () => {
      const initialState = {
        builtIn: [],
        custom: [
          {
            id: 'custom_1',
            name: 'Old Name',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
        ],
        isLoading: false,
      };

      const updatedAdjustments = {
        ...createInitialAdjustmentState(),
        exposure: 3,
      };

      const result = presetReducer(
        initialState,
        updateCustomPreset({
          id: 'custom_1',
          name: 'New Name',
          adjustments: updatedAdjustments,
        })
      );

      expect(result.custom[0].name).toBe('New Name');
      expect(result.custom[0].adjustments.exposure).toBe(3);
    });

    it('should not update if preset id not found', () => {
      const initialState = {
        builtIn: [],
        custom: [
          {
            id: 'custom_1',
            name: 'Preset 1',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
        ],
        isLoading: false,
      };

      const result = presetReducer(
        initialState,
        updateCustomPreset({
          id: 'custom_999',
          name: 'New Name',
          adjustments: createInitialAdjustmentState(),
        })
      );

      expect(result.custom[0].name).toBe('Preset 1');
    });
  });

  describe('loadCustomPresets', () => {
    it('should load custom presets from localStorage', () => {
      const presets: Preset[] = [
        {
          id: 'custom_1',
          name: 'Stored Preset',
          adjustments: createInitialAdjustmentState(),
          isBuiltIn: false,
        },
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

      const initialState = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      const result = presetReducer(initialState, loadCustomPresets());

      expect(result.custom.length).toBe(1);
      expect(result.custom[0].name).toBe('Stored Preset');
    });

    it('should handle empty localStorage', () => {
      const initialState = {
        builtIn: [],
        custom: [],
        isLoading: false,
      };

      const result = presetReducer(initialState, loadCustomPresets());

      expect(result.custom.length).toBe(0);
    });
  });

  describe('clearCustomPresets', () => {
    it('should clear all custom presets', () => {
      const initialState = {
        builtIn: [],
        custom: [
          {
            id: 'custom_1',
            name: 'Preset 1',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
          {
            id: 'custom_2',
            name: 'Preset 2',
            adjustments: createInitialAdjustmentState(),
            isBuiltIn: false,
          },
        ],
        isLoading: false,
      };

      const result = presetReducer(initialState, clearCustomPresets());

      expect(result.custom.length).toBe(0);
    });

    it('should clear localStorage', () => {
      const presets: Preset[] = [
        {
          id: 'custom_1',
          name: 'Preset 1',
          adjustments: createInitialAdjustmentState(),
          isBuiltIn: false,
        },
      ];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));

      const initialState = {
        builtIn: [],
        custom: presets,
        isLoading: false,
      };

      presetReducer(initialState, clearCustomPresets());

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(0);
    });
  });
});
