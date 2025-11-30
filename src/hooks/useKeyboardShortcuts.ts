/**
 * useKeyboardShortcuts Hook
 * Centralized keyboard shortcut management for the application
 */

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { undo, redo } from '../store/historySlice';
import { undoImageEdit, selectImageHistoryCount } from '../store/imageSlice';
import { setShowComparison, toggleHistogram, resetView } from '../store/uiSlice';
import {
  setExposure,
  setContrast,
  setSaturation,
  setHighlights,
  setShadows,
  resetAdjustments,
} from '../store';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  category: 'editing' | 'view' | 'navigation' | 'tools' | 'adjustments';
}

export const useKeyboardShortcuts = () => {
  const dispatch = useDispatch();
  const hasImage = useSelector((state: RootState) => state.image.current !== null);
  const exposure = useSelector((state: RootState) => state.adjustments.exposure);
  const contrast = useSelector((state: RootState) => state.adjustments.contrast);
  const saturation = useSelector((state: RootState) => state.adjustments.saturation);
  const highlights = useSelector((state: RootState) => state.adjustments.highlights);
  const shadows = useSelector((state: RootState) => state.adjustments.shadows);
  const adjustmentHistoryCount = useSelector((state: RootState) => state.history.past.length);
  const imageHistoryCount = useSelector(selectImageHistoryCount);

  // Define all keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // History shortcuts
    {
      key: 'z',
      ctrl: true,
      description: 'Undo last action',
      action: () => {
        // First try to undo adjustment history, then image history
        if (adjustmentHistoryCount > 0) {
          dispatch(undo());
        } else if (imageHistoryCount > 0) {
          dispatch(undoImageEdit());
        }
      },
      category: 'editing',
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Redo last undone action',
      action: () => dispatch(redo()),
      category: 'editing',
    },
    {
      key: 'y',
      ctrl: true,
      description: 'Redo last undone action',
      action: () => dispatch(redo()),
      category: 'editing',
    },
    {
      key: 'r',
      ctrl: true,
      description: 'Reset all adjustments',
      action: () => {
        if (hasImage) {
          dispatch(resetAdjustments());
        }
      },
      category: 'editing',
    },
    // View shortcuts (spacebar handled separately in handleKeyDown/handleKeyUp)
    {
      key: 'c',
      description: 'Hold to show before',
      action: () => {}, // Handled in handleKeyDown/handleKeyUp
      category: 'view',
    },
    {
      key: 'h',
      description: 'Toggle histogram',
      action: () => dispatch(toggleHistogram()),
      category: 'view',
    },
    {
      key: '0',
      ctrl: true,
      description: 'Reset view to 100%',
      action: () => dispatch(resetView()),
      category: 'view',
    },
    {
      key: 'f',
      description: 'Fit image to view',
      action: () => dispatch(resetView()),
      category: 'view',
    },
    // Adjustment shortcuts (only work when image is loaded)
    {
      key: 'e',
      shift: true,
      description: 'Increase exposure (+5)',
      action: () => {
        if (hasImage) {
          dispatch(setExposure(Math.min(100, exposure + 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'e',
      ctrl: true,
      description: 'Decrease exposure (-5)',
      action: () => {
        if (hasImage) {
          dispatch(setExposure(Math.max(-100, exposure - 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'c',
      shift: true,
      description: 'Increase contrast (+5)',
      action: () => {
        if (hasImage) {
          dispatch(setContrast(Math.min(100, contrast + 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'c',
      ctrl: true,
      description: 'Decrease contrast (-5)',
      action: () => {
        if (hasImage) {
          dispatch(setContrast(Math.max(-100, contrast - 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 's',
      shift: true,
      description: 'Increase saturation (+5)',
      action: () => {
        if (hasImage) {
          dispatch(setSaturation(Math.min(100, saturation + 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 's',
      ctrl: true,
      description: 'Decrease saturation (-5)',
      action: () => {
        if (hasImage) {
          dispatch(setSaturation(Math.max(-100, saturation - 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'ArrowUp',
      shift: true,
      description: 'Increase highlights (+5)',
      action: () => {
        if (hasImage) {
          dispatch(setHighlights(Math.min(100, highlights + 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'ArrowDown',
      shift: true,
      description: 'Decrease highlights (-5)',
      action: () => {
        if (hasImage) {
          dispatch(setHighlights(Math.max(-100, highlights - 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'ArrowUp',
      ctrl: true,
      description: 'Increase shadows (+5)',
      action: () => {
        if (hasImage) {
          dispatch(setShadows(Math.min(100, shadows + 5)));
        }
      },
      category: 'adjustments',
    },
    {
      key: 'ArrowDown',
      ctrl: true,
      description: 'Decrease shadows (-5)',
      action: () => {
        if (hasImage) {
          dispatch(setShadows(Math.max(-100, shadows - 5)));
        }
      },
      category: 'adjustments',
    },
    // Navigation shortcuts
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => {
        // This will be handled by the ShortcutPanel component
        window.dispatchEvent(new CustomEvent('toggle-shortcuts-panel'));
      },
      category: 'navigation',
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Special handling for spacebar: show "before" while held
      if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        dispatch(setShowComparison(true));
        return;
      }

      // Find matching shortcut
      const matchingShortcut = shortcuts.find((shortcut) => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatches = !!shortcut.shift === event.shiftKey;
        const altMatches = !!shortcut.alt === event.altKey;

        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    },
    [shortcuts, dispatch]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Special handling for spacebar: hide "before" when released
      if (event.key === ' ') {
        event.preventDefault();
        dispatch(setShowComparison(false));
      }
    },
    [dispatch]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return { shortcuts };
};

/**
 * Format shortcut for display
 */
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  // Detect Mac vs Windows/Linux
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (shortcut.ctrl) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format key
  let key = shortcut.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);

  return parts.join(isMac ? '' : '+');
};
