/**
 * History Hook
 * Provides undo/redo functionality with automatic adjustment state synchronization
 * The middleware handles syncing adjustments with history state
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { undo as undoAction, redo as redoAction } from '../store/historySlice';
import type { RootState } from '../store';

export const useHistory = () => {
  const dispatch = useDispatch();
  const history = useSelector((state: RootState) => state.history);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;
    // Middleware will handle syncing adjustments with history
    dispatch(undoAction());
  }, [canUndo, dispatch]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    // Middleware will handle syncing adjustments with history
    dispatch(redoAction());
  }, [canRedo, dispatch]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    historyPosition: {
      past: history.past.length,
      future: history.future.length,
    },
  };
};
