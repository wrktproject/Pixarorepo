/**
 * useAdjustmentWithHistory Hook
 * Provides adjustment setters that automatically save to history on completion
 */

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { addToHistory } from '../store/historySlice';

export function useAdjustmentWithHistory<T>(
  setter: (value: T) => void
): [(value: T) => void, (value: T) => void] {
  const dispatch = useDispatch();
  const currentAdjustments = useSelector((state: RootState) => state.adjustments);

  // onChange: called during slider drag (no history)
  const handleChange = useCallback((value: T) => {
    setter(value);
  }, [setter]);

  // onChangeComplete: called when slider is released (save to history)
  const handleChangeComplete = useCallback((value: T) => {
    // Save current state to history
    dispatch(addToHistory(currentAdjustments));
  }, [dispatch, currentAdjustments]);

  return [handleChange, handleChangeComplete];
}
