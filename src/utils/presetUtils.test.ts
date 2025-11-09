/**
 * Preset Utilities Tests
 * Tests for preset application and validation functions
 */

import { describe, it, expect, vi } from 'vitest';
import {
  applyPreset,
  createPresetFromAdjustments,
  validatePresetName,
  presetNameExists,
} from './presetUtils';
import { createInitialAdjustmentState } from '../store/initialState';
import type { Preset } from '../types/store';
import type { AdjustmentState } from '../types/adjustments';

describe('presetUtils', () => {
  describe('applyPreset', () => {
    it('should dispatch addToHistory and setAllAdjustments', () => {
      const dispatch = vi.fn();
      const currentAdjustments = createInitialAdjustmentState();
      const preset: Preset = {
        id: 'test_preset',
        name: 'Test Preset',
        isBuiltIn: true,
        adjustments: {
          ...createInitialAdjustmentState(),
          exposure: 2,
          contrast: 30,
        },
      };

      applyPreset(preset, dispatch, currentAdjustments);

      expect(dispatch).toHaveBeenCalledTimes(2);
      // First call should be addToHistory with current adjustments
      expect(dispatch.mock.calls[0][0].type).toBe('history/addToHistory');
      // Second call should be setAllAdjustments with preset adjustments
      expect(dispatch.mock.calls[1][0].type).toBe('adjustments/setAllAdjustments');
    });

    it('should preserve existing removal operations', () => {
      const dispatch = vi.fn();
      const removalOp = {
        id: 'removal_1',
        mask: {
          pixels: new Uint8Array([1, 2, 3]),
          bounds: { x: 0, y: 0, width: 10, height: 10 },
        },
        timestamp: Date.now(),
      };

      const currentAdjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        removals: [removalOp],
      };

      const preset: Preset = {
        id: 'test_preset',
        name: 'Test Preset',
        isBuiltIn: true,
        adjustments: {
          ...createInitialAdjustmentState(),
          exposure: 2,
        },
      };

      applyPreset(preset, dispatch, currentAdjustments);

      const setAllAdjustmentsCall = dispatch.mock.calls[1][0];
      expect(setAllAdjustmentsCall.payload.removals).toEqual([removalOp]);
    });
  });

  describe('createPresetFromAdjustments', () => {
    it('should create preset with given name and adjustments', () => {
      const adjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        exposure: 2,
        contrast: 30,
        saturation: 20,
      };

      const result = createPresetFromAdjustments('My Preset', adjustments);

      expect(result.name).toBe('My Preset');
      expect(result.adjustments.exposure).toBe(2);
      expect(result.adjustments.contrast).toBe(30);
      expect(result.adjustments.saturation).toBe(20);
    });

    it('should reset crop and straighten to defaults', () => {
      const adjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        crop: { x: 10, y: 10, width: 100, height: 100, aspectRatio: 1 },
        straighten: 5,
      };

      const result = createPresetFromAdjustments('Test', adjustments);

      expect(result.adjustments.crop).toBeNull();
      expect(result.adjustments.straighten).toBe(0);
    });

    it('should clear removal operations', () => {
      const adjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        removals: [
          {
            id: 'removal_1',
            mask: {
              pixels: new Uint8Array([1, 2, 3]),
              bounds: { x: 0, y: 0, width: 10, height: 10 },
            },
            timestamp: Date.now(),
          },
        ],
      };

      const result = createPresetFromAdjustments('Test', adjustments);

      expect(result.adjustments.removals).toEqual([]);
    });
  });

  describe('validatePresetName', () => {
    it('should return null for valid names', () => {
      expect(validatePresetName('Valid Name')).toBeNull();
      expect(validatePresetName('My Preset 123')).toBeNull();
      expect(validatePresetName('A')).toBeNull();
    });

    it('should return error for empty names', () => {
      expect(validatePresetName('')).toBe('Preset name cannot be empty');
      expect(validatePresetName('   ')).toBe('Preset name cannot be empty');
    });

    it('should return error for names exceeding 50 characters', () => {
      const longName = 'a'.repeat(51);
      expect(validatePresetName(longName)).toBe(
        'Preset name must be 50 characters or less'
      );
    });

    it('should accept names with exactly 50 characters', () => {
      const maxName = 'a'.repeat(50);
      expect(validatePresetName(maxName)).toBeNull();
    });
  });

  describe('presetNameExists', () => {
    const existingPresets: Preset[] = [
      {
        id: 'preset1',
        name: 'Portrait',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
      {
        id: 'preset2',
        name: 'Landscape',
        isBuiltIn: true,
        adjustments: createInitialAdjustmentState(),
      },
      {
        id: 'preset3',
        name: 'My Custom Preset',
        isBuiltIn: false,
        adjustments: createInitialAdjustmentState(),
      },
    ];

    it('should return true for existing preset names', () => {
      expect(presetNameExists('Portrait', existingPresets)).toBe(true);
      expect(presetNameExists('Landscape', existingPresets)).toBe(true);
      expect(presetNameExists('My Custom Preset', existingPresets)).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(presetNameExists('portrait', existingPresets)).toBe(true);
      expect(presetNameExists('LANDSCAPE', existingPresets)).toBe(true);
      expect(presetNameExists('my custom preset', existingPresets)).toBe(true);
    });

    it('should ignore leading/trailing whitespace', () => {
      expect(presetNameExists('  Portrait  ', existingPresets)).toBe(true);
      expect(presetNameExists(' Landscape ', existingPresets)).toBe(true);
    });

    it('should return false for non-existing names', () => {
      expect(presetNameExists('Non-existent', existingPresets)).toBe(false);
      expect(presetNameExists('Another Preset', existingPresets)).toBe(false);
    });

    it('should return false for empty preset list', () => {
      expect(presetNameExists('Any Name', [])).toBe(false);
    });
  });
});
