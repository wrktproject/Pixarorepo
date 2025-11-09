/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts including undo/redo
 */

import { useEffect } from 'react';
import { useHistory } from './useHistory';

export const useKeyboardShortcuts = () => {
  const { undo, redo, canUndo, canRedo } = useHistory();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (Mac)
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Undo: Ctrl+Z or Cmd+Z
      if (isCtrlOrCmd && event.key === 'z' && !event.shiftKey && canUndo) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac)
      if (
        canRedo &&
        ((isCtrlOrCmd && event.key === 'y' && !event.shiftKey) ||
          (isCtrlOrCmd && event.shiftKey && event.key === 'z'))
      ) {
        event.preventDefault();
        redo();
        return;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undo, redo, canUndo, canRedo]);
};
