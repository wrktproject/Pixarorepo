/**
 * History Indicator Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { HistoryIndicator } from './HistoryIndicator';
import adjustmentsReducer, { setExposure } from '../store/adjustmentsSlice';
import historyReducer from '../store/historySlice';
import { historyMiddleware } from '../store/historyMiddleware';

describe('HistoryIndicator', () => {
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

  it('should render with disabled buttons when history is empty', () => {
    const store = createTestStore();

    render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    const undoButton = screen.getByLabelText('Undo');
    const redoButton = screen.getByLabelText('Redo');

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it('should enable undo button when history exists', () => {
    const store = createTestStore();
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));

    render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    const undoButton = screen.getByLabelText('Undo');
    expect(undoButton).not.toBeDisabled();
  });

  it('should display correct history position', () => {
    const store = createTestStore();
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));
    store.dispatch(setExposure(3));

    render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    // Should show 3 / 4 (3 past states + 1 present)
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
  });

  it('should trigger undo when undo button is clicked', () => {
    const store = createTestStore();
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));

    render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    const undoButton = screen.getByLabelText('Undo');
    fireEvent.click(undoButton);

    const state = store.getState();
    expect(state.adjustments.exposure).toBe(1);
  });

  it('should trigger redo when redo button is clicked', () => {
    const store = createTestStore();
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));

    render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    // Undo first
    const undoButton = screen.getByLabelText('Undo');
    fireEvent.click(undoButton);

    // Then redo
    const redoButton = screen.getByLabelText('Redo');
    fireEvent.click(redoButton);

    const state = store.getState();
    expect(state.adjustments.exposure).toBe(2);
  });

  it('should update position after undo', () => {
    const store = createTestStore();
    store.dispatch(setExposure(1));
    store.dispatch(setExposure(2));
    store.dispatch(setExposure(3));

    const { rerender } = render(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    expect(screen.getByText('3 / 4')).toBeInTheDocument();

    // Undo
    const undoButton = screen.getByLabelText('Undo');
    fireEvent.click(undoButton);

    rerender(
      <Provider store={store}>
        <HistoryIndicator />
      </Provider>
    );

    expect(screen.getByText('2 / 4')).toBeInTheDocument();
  });
});
