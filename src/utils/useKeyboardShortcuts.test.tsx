/**
 * Keyboard Shortcuts Tests
 * Tests for keyboard shortcut handling
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import adjustmentsReducer, { setExposure } from '../store/adjustmentsSlice';
import historyReducer from '../store/historySlice';
import { historyMiddleware } from '../store/historyMiddleware';

const createTestStore = () => {
  return configureStore({
    reducer: {
      adjustments: adjustmentsReducer,
      history: historyReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }).concat(historyMiddleware),
  });
};

type TestStore = ReturnType<typeof createTestStore>;
type TestState = ReturnType<TestStore['getState']>;

describe('useKeyboardShortcuts', () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  it('should handle Ctrl+Z for undo', () => {
    // Make some changes
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));

    renderHook(() => useKeyboardShortcuts(), { wrapper });

    // Simulate Ctrl+Z
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    // Check that undo was triggered
    const state = store.getState() as TestState;
    expect(state.adjustments.exposure).toBe(1);
  });

  it('should handle Cmd+Z for undo on Mac', () => {
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));

    renderHook(() => useKeyboardShortcuts(), { wrapper });

    // Simulate Cmd+Z (metaKey for Mac)
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    const state = store.getState() as TestState;
    expect(state.adjustments.exposure).toBe(1);
  });

  it('should register keyboard event listeners', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts(), { wrapper });
    
    // Just verify the hook mounts and unmounts without errors
    expect(unmount).toBeDefined();
    unmount();
  });

  it('should not undo when history is empty', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper });

    const initialState = store.getState() as TestState;

    // Try to undo with empty history
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    const state = store.getState() as TestState;
    expect(state.adjustments.exposure).toBe(initialState.adjustments.exposure);
  });

  it('should not redo when future is empty', () => {
    store.dispatch(setExposure(1));

    renderHook(() => useKeyboardShortcuts(), { wrapper });

    // Try to redo with empty future
    const event = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    const state = store.getState() as TestState;
    expect(state.adjustments.exposure).toBe(1);
  });
});
