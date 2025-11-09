/**
 * History Middleware Tests
 * Tests for automatic history tracking and undo/redo synchronization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import adjustmentsReducer, { setExposure, setContrast } from './adjustmentsSlice';
import historyReducer, { undo, redo } from './historySlice';
import { historyMiddleware } from './historyMiddleware';

describe('historyMiddleware', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        adjustments: adjustmentsReducer,
        history: historyReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }).concat(historyMiddleware),
    });
  });

  it('should add adjustment actions to history', () => {
    // Initial state
    const initialHistory = store.getState().history;
    expect(initialHistory.past.length).toBe(0);

    // Dispatch an adjustment action
    store.dispatch(setExposure(2));

    // Check that history was updated
    const state = store.getState();
    expect(state.history.past.length).toBe(1);
    expect(state.history.present.exposure).toBe(2);
    expect(state.adjustments.exposure).toBe(2);
  });

  it('should track multiple adjustment actions', () => {
    store.dispatch(setExposure(1));
    store.dispatch(setContrast(50));
    store.dispatch(setExposure(2));

    const state = store.getState();
    expect(state.history.past.length).toBe(3);
    expect(state.history.present.exposure).toBe(2);
    expect(state.history.present.contrast).toBe(50);
  });

  it('should sync adjustments when undo is dispatched', () => {
    // Make some changes
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));
    store.dispatch(setExposure(3));

    // Undo
    store.dispatch(undo());

    const state = store.getState();
    // Both history and adjustments should be in sync
    expect(state.history.present.exposure).toBe(2);
    expect(state.adjustments.exposure).toBe(2);
  });

  it('should sync adjustments when redo is dispatched', () => {
    // Make changes and undo
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));
    store.dispatch(undo());

    // Redo
    store.dispatch(redo());

    const state = store.getState();
    // Both should be in sync
    expect(state.history.present.exposure).toBe(2);
    expect(state.adjustments.exposure).toBe(2);
  });

  it('should enforce history limit', () => {
    // Add more than 50 actions
    for (let i = 0; i < 52; i++) {
      store.dispatch(setExposure(i / 10));
    }

    const state = store.getState();
    expect(state.history.past.length).toBeLessThanOrEqual(50);
  });

  it('should clear future when new action is dispatched after undo', () => {
    // Make changes
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));
    store.dispatch(setExposure(3));

    // Undo twice
    store.dispatch(undo());
    store.dispatch(undo());

    let state = store.getState();
    expect(state.history.future.length).toBe(2);

    // Make a new change
    store.dispatch(setContrast(50));

    state = store.getState();
    expect(state.history.future.length).toBe(0);
  });
});
