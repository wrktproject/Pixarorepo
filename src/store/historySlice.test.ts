/**
 * History Slice Tests
 * Tests for undo/redo history management
 */

import { describe, it, expect } from 'vitest';
import historyReducer, {
  addToHistory,
  undo,
  redo,
  clearHistory,
  resetHistory,
} from './historySlice';
import { createInitialAdjustmentState } from './initialState';
import { AdjustmentState } from '../types/adjustments';

describe('historySlice', () => {
  describe('addToHistory', () => {
    it('should add a new state to history', () => {
      const initialState = {
        past: [],
        present: createInitialAdjustmentState(),
        future: [],
        maxHistorySize: 50,
      };

      const newAdjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        exposure: 2,
      };

      const result = historyReducer(initialState, addToHistory(newAdjustments));

      expect(result.past.length).toBe(1);
      expect(result.present.exposure).toBe(2);
      expect(result.future.length).toBe(0);
    });

    it('should clear future when adding new state', () => {
      const initialState = {
        past: [createInitialAdjustmentState()],
        present: { ...createInitialAdjustmentState(), exposure: 1 },
        future: [
          { ...createInitialAdjustmentState(), exposure: 2 },
          { ...createInitialAdjustmentState(), exposure: 3 },
        ],
        maxHistorySize: 50,
      };

      const newAdjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        exposure: 4,
      };

      const result = historyReducer(initialState, addToHistory(newAdjustments));

      expect(result.future.length).toBe(0);
      expect(result.present.exposure).toBe(4);
    });

    it('should enforce max history size', () => {
      const past: AdjustmentState[] = [];
      for (let i = 0; i < 50; i++) {
        past.push({ ...createInitialAdjustmentState(), exposure: i });
      }

      const initialState = {
        past,
        present: { ...createInitialAdjustmentState(), exposure: 50 },
        future: [],
        maxHistorySize: 50,
      };

      const newAdjustments: AdjustmentState = {
        ...createInitialAdjustmentState(),
        exposure: 51,
      };

      const result = historyReducer(initialState, addToHistory(newAdjustments));

      expect(result.past.length).toBe(50);
      expect(result.past[0].exposure).toBe(1); // First item removed
      expect(result.present.exposure).toBe(51);
    });
  });

  describe('undo', () => {
    it('should undo to previous state', () => {
      const initialState = {
        past: [
          createInitialAdjustmentState(),
          { ...createInitialAdjustmentState(), exposure: 1 },
        ],
        present: { ...createInitialAdjustmentState(), exposure: 2 },
        future: [],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, undo());

      expect(result.past.length).toBe(1);
      expect(result.present.exposure).toBe(1);
      expect(result.future.length).toBe(1);
      expect(result.future[0].exposure).toBe(2);
    });

    it('should do nothing when past is empty', () => {
      const initialState = {
        past: [],
        present: createInitialAdjustmentState(),
        future: [],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, undo());

      expect(result.past.length).toBe(0);
      expect(result.future.length).toBe(0);
    });

    it('should allow multiple undos', () => {
      const initialState = {
        past: [
          { ...createInitialAdjustmentState(), exposure: 0 },
          { ...createInitialAdjustmentState(), exposure: 1 },
          { ...createInitialAdjustmentState(), exposure: 2 },
        ],
        present: { ...createInitialAdjustmentState(), exposure: 3 },
        future: [],
        maxHistorySize: 50,
      };

      let result = historyReducer(initialState, undo());
      expect(result.present.exposure).toBe(2);

      result = historyReducer(result, undo());
      expect(result.present.exposure).toBe(1);

      result = historyReducer(result, undo());
      expect(result.present.exposure).toBe(0);
    });
  });

  describe('redo', () => {
    it('should redo to next state', () => {
      const initialState = {
        past: [createInitialAdjustmentState()],
        present: { ...createInitialAdjustmentState(), exposure: 1 },
        future: [
          { ...createInitialAdjustmentState(), exposure: 2 },
          { ...createInitialAdjustmentState(), exposure: 3 },
        ],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, redo());

      expect(result.past.length).toBe(2);
      expect(result.present.exposure).toBe(2);
      expect(result.future.length).toBe(1);
      expect(result.future[0].exposure).toBe(3);
    });

    it('should do nothing when future is empty', () => {
      const initialState = {
        past: [createInitialAdjustmentState()],
        present: { ...createInitialAdjustmentState(), exposure: 1 },
        future: [],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, redo());

      expect(result.past.length).toBe(1);
      expect(result.present.exposure).toBe(1);
      expect(result.future.length).toBe(0);
    });

    it('should allow multiple redos', () => {
      const initialState = {
        past: [],
        present: { ...createInitialAdjustmentState(), exposure: 0 },
        future: [
          { ...createInitialAdjustmentState(), exposure: 1 },
          { ...createInitialAdjustmentState(), exposure: 2 },
          { ...createInitialAdjustmentState(), exposure: 3 },
        ],
        maxHistorySize: 50,
      };

      let result = historyReducer(initialState, redo());
      expect(result.present.exposure).toBe(1);

      result = historyReducer(result, redo());
      expect(result.present.exposure).toBe(2);

      result = historyReducer(result, redo());
      expect(result.present.exposure).toBe(3);
    });
  });

  describe('undo and redo together', () => {
    it('should support undo followed by redo', () => {
      const initialState = {
        past: [
          { ...createInitialAdjustmentState(), exposure: 0 },
          { ...createInitialAdjustmentState(), exposure: 1 },
        ],
        present: { ...createInitialAdjustmentState(), exposure: 2 },
        future: [],
        maxHistorySize: 50,
      };

      let result = historyReducer(initialState, undo());
      expect(result.present.exposure).toBe(1);

      result = historyReducer(result, redo());
      expect(result.present.exposure).toBe(2);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const initialState = {
        past: [
          { ...createInitialAdjustmentState(), exposure: 0 },
          { ...createInitialAdjustmentState(), exposure: 1 },
        ],
        present: { ...createInitialAdjustmentState(), exposure: 2 },
        future: [{ ...createInitialAdjustmentState(), exposure: 3 }],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, clearHistory());

      expect(result.past.length).toBe(0);
      expect(result.future.length).toBe(0);
      expect(result.present.exposure).toBe(0);
    });
  });

  describe('resetHistory', () => {
    it('should reset to initial state', () => {
      const initialState = {
        past: [{ ...createInitialAdjustmentState(), exposure: 1 }],
        present: { ...createInitialAdjustmentState(), exposure: 2 },
        future: [{ ...createInitialAdjustmentState(), exposure: 3 }],
        maxHistorySize: 50,
      };

      const result = historyReducer(initialState, resetHistory());

      expect(result.past.length).toBe(0);
      expect(result.future.length).toBe(0);
      expect(result.present.exposure).toBe(0);
      expect(result.maxHistorySize).toBe(50);
    });
  });
});
