/**
 * History Hook
 * Provides undo/redo functionality with automatic adjustment state synchronization
 * The middleware handles syncing adjustments with history state
 * Also tracks image edit history for destructive edits (like content-aware fill)
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { undo as undoAction, redo as redoAction } from '../store/historySlice';
import { undoImageEdit, selectImageHistoryCount } from '../store/imageSlice';
import type { RootState } from '../store';

export const useHistory = () => {
  const dispatch = useDispatch();
  const history = useSelector((state: RootState) => state.history);
  const imageHistoryCount = useSelector(selectImageHistoryCount);

  const canUndo = history.past.length > 0 || imageHistoryCount > 0;
  const canRedo = history.future.length > 0;

  const undo = useCallback(() => {
    // First undo adjustment history, then image history
    if (history.past.length > 0) {
      dispatch(undoAction());
    } else if (imageHistoryCount > 0) {
      dispatch(undoImageEdit());
    }
  }, [history.past.length, imageHistoryCount, dispatch]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    // Note: We currently don't support redo for image edits
    dispatch(redoAction());
  }, [canRedo, dispatch]);

  // Total changes = adjustment history + image edit history
  const totalPast = history.past.length + imageHistoryCount;

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    historyPosition: {
      past: totalPast,
      future: history.future.length,
    },
    // Separate counts for debugging/display
    adjustmentHistoryCount: history.past.length,
    imageHistoryCount,
  };
};
