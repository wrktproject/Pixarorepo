/**
 * History Slice
 * Implements undo/redo functionality with 50-action limit
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { HistoryState } from '../types/store';
import type { AdjustmentState } from '../types/adjustments';
import { createInitialAdjustmentState } from './initialState';

const initialState: HistoryState = {
  past: [],
  present: createInitialAdjustmentState(),
  future: [],
  maxHistorySize: 50,
};

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    // Add a new state to history
    addToHistory: (state, action: PayloadAction<AdjustmentState>) => {
      // Move current present to past
      state.past.push(state.present);

      // Enforce max history size by removing oldest entries
      if (state.past.length > state.maxHistorySize) {
        state.past.shift();
      }

      // Set new present
      state.present = action.payload;

      // Clear future (new action invalidates redo history)
      state.future = [];
    },

    // Undo: move back in history
    undo: (state) => {
      if (state.past.length === 0) {
        return; // Nothing to undo
      }

      // Move current present to future
      state.future.unshift(state.present);

      // Restore previous state from past
      const previous = state.past.pop();
      if (previous) {
        state.present = previous;
      }
    },

    // Redo: move forward in history
    redo: (state) => {
      if (state.future.length === 0) {
        return; // Nothing to redo
      }

      // Move current present to past
      state.past.push(state.present);

      // Enforce max history size
      if (state.past.length > state.maxHistorySize) {
        state.past.shift();
      }

      // Restore next state from future
      const next = state.future.shift();
      if (next) {
        state.present = next;
      }
    },

    // Set present state without affecting history
    setPresent: (state, action: PayloadAction<AdjustmentState>) => {
      state.present = action.payload;
    },

    // Clear all history
    clearHistory: (state) => {
      state.past = [];
      state.future = [];
      state.present = createInitialAdjustmentState();
    },

    // Reset to initial state or with a specific adjustment state
    resetHistory: (state, action: PayloadAction<AdjustmentState | undefined>) => {
      state.past = [];
      state.future = [];
      state.present = action.payload || createInitialAdjustmentState();
    },
  },
});

export const { addToHistory, undo, redo, setPresent, clearHistory, resetHistory } =
  historySlice.actions;

export default historySlice.reducer;
