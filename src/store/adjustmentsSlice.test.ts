/**
 * Adjustments Slice Tests
 * Tests for adjustment value updates and clamping
 */

import { describe, it, expect } from 'vitest';
import adjustmentsReducer, {
  setExposure,
  setContrast,
  setTemperature,
  setTint,
  setSharpening,
  setHSLHue,
  setStraighten,
  setVignetteAmount,
  setGrainAmount,
  resetAdjustments,
  setAllAdjustments,
} from './adjustmentsSlice';
import { createInitialAdjustmentState } from './initialState';

describe('adjustmentsSlice', () => {
  describe('basic adjustments', () => {
    it('should set exposure within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setExposure(2.5));
      expect(result.exposure).toBe(2.5);
    });

    it('should clamp exposure to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setExposure(10));
      expect(result.exposure).toBe(5);
    });

    it('should clamp exposure to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setExposure(-10));
      expect(result.exposure).toBe(-5);
    });

    it('should set contrast within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setContrast(50));
      expect(result.contrast).toBe(50);
    });

    it('should clamp contrast to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setContrast(150));
      expect(result.contrast).toBe(100);
    });

    it('should clamp contrast to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setContrast(-150));
      expect(result.contrast).toBe(-100);
    });
  });

  describe('color adjustments', () => {
    it('should set temperature within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setTemperature(5000));
      expect(result.temperature).toBe(5000);
    });

    it('should clamp temperature to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setTemperature(60000));
      expect(result.temperature).toBe(50000);
    });

    it('should clamp temperature to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setTemperature(1000));
      expect(result.temperature).toBe(2000);
    });

    it('should set tint within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setTint(50));
      expect(result.tint).toBe(50);
    });

    it('should clamp tint to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setTint(200));
      expect(result.tint).toBe(150);
    });
  });

  describe('detail adjustments', () => {
    it('should set sharpening within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setSharpening(75));
      expect(result.sharpening).toBe(75);
    });

    it('should clamp sharpening to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setSharpening(200));
      expect(result.sharpening).toBe(150);
    });

    it('should clamp sharpening to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setSharpening(-10));
      expect(result.sharpening).toBe(0);
    });
  });

  describe('HSL adjustments', () => {
    it('should set HSL hue for a color channel', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(
        state,
        setHSLHue({ channel: 'red', value: 50 })
      );
      expect(result.hsl.red.hue).toBe(50);
    });

    it('should clamp HSL hue to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(
        state,
        setHSLHue({ channel: 'blue', value: 150 })
      );
      expect(result.hsl.blue.hue).toBe(100);
    });

    it('should clamp HSL hue to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(
        state,
        setHSLHue({ channel: 'green', value: -150 })
      );
      expect(result.hsl.green.hue).toBe(-100);
    });
  });

  describe('geometric adjustments', () => {
    it('should set straighten angle within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setStraighten(15));
      expect(result.straighten).toBe(15);
    });

    it('should clamp straighten to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setStraighten(60));
      expect(result.straighten).toBe(45);
    });

    it('should clamp straighten to minimum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setStraighten(-60));
      expect(result.straighten).toBe(-45);
    });
  });

  describe('effects adjustments', () => {
    it('should set vignette amount within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setVignetteAmount(50));
      expect(result.vignette.amount).toBe(50);
    });

    it('should clamp vignette amount to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setVignetteAmount(150));
      expect(result.vignette.amount).toBe(100);
    });

    it('should set grain amount within valid range', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setGrainAmount(50));
      expect(result.grain.amount).toBe(50);
    });

    it('should clamp grain amount to maximum value', () => {
      const state = createInitialAdjustmentState();
      const result = adjustmentsReducer(state, setGrainAmount(150));
      expect(result.grain.amount).toBe(100);
    });
  });

  describe('bulk operations', () => {
    it('should reset all adjustments to initial state', () => {
      let state = createInitialAdjustmentState();
      state = adjustmentsReducer(state, setExposure(3));
      state = adjustmentsReducer(state, setContrast(50));
      state = adjustmentsReducer(state, setTemperature(8000));

      const result = adjustmentsReducer(state, resetAdjustments());

      expect(result.exposure).toBe(0);
      expect(result.contrast).toBe(0);
      expect(result.temperature).toBe(6500);
    });

    it('should set all adjustments at once', () => {
      const state = createInitialAdjustmentState();
      const newAdjustments = {
        ...createInitialAdjustmentState(),
        exposure: 2,
        contrast: 30,
        temperature: 7000,
      };

      const result = adjustmentsReducer(state, setAllAdjustments(newAdjustments));

      expect(result.exposure).toBe(2);
      expect(result.contrast).toBe(30);
      expect(result.temperature).toBe(7000);
    });
  });
});
