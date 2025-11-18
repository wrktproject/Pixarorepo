/**
 * History Middleware
 * Intercepts adjustment actions and automatically updates history state
 * Also syncs adjustments when undo/redo actions are dispatched
 */

import { addToHistory, undo, redo } from './historySlice';
import { setAllAdjustments } from './adjustmentsSlice';

// List of adjustment actions that should trigger history updates
// NOTE: Most slider adjustments manually call addToHistory on mouse release
// Only actions without explicit onChangeComplete handlers should be here
const ADJUSTMENT_ACTIONS = [
  'adjustments/addRemovalOperation',
  'adjustments/removeRemovalOperation',
  'adjustments/setCrop', // Crop applies on "Apply" button
  'adjustments/setStraighten', // Straighten uses explicit handler
];

// Actions that should NOT trigger history updates
const EXCLUDED_ACTIONS = [
  'history/undo',
  'history/redo',
  'history/setPresent',
  'history/clearHistory',
  'history/resetHistory',
  'adjustments/resetAdjustments',
  'adjustments/clearRemovalOperations',
  'adjustments/setCropPreview', // Don't add to history while dragging crop
  'adjustments/setStraightenPreview', // Don't add to history while dragging rotation slider
  'adjustments/setAllAdjustments',
];

/**
 * Middleware that:
 * 1. Intercepts adjustment actions and adds them to history
 * 2. Syncs adjustments state when undo/redo is triggered
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const historyMiddleware = (store: any) => (next: any) => (action: any) => {
  // Check if this is an action we should track
  const shouldTrack =
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof action.type === 'string' &&
    ADJUSTMENT_ACTIONS.includes(action.type) &&
    !EXCLUDED_ACTIONS.includes(action.type);

  // Check if this is an undo/redo action
  const isUndoRedo =
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    (action.type === undo.type || action.type === redo.type);

  // Let the action pass through first
  const result = next(action);

  // After the action has been processed
  if (shouldTrack) {
    // Add the current adjustment state to history
    const state = store.getState();
    store.dispatch(addToHistory(state.adjustments));
  } else if (isUndoRedo) {
    // Sync adjustments with the new present state from history
    const state = store.getState();
    store.dispatch(setAllAdjustments(state.history.present));
  }

  return result;
};
