/**
 * useKeyboardShortcuts Hook
 * Centralized keyboard shortcut management for the application
 */

import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { undo, redo } from '../store/historySlice';
import { toggleComparison, toggleHistogram, resetView } from '../store/uiSlice';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  category: 'editing' | 'view' | 'navigation' | 'tools';
}

export const useKeyboardShortcuts = () => {
  const dispatch = useDispatch();

  // Define all keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // History shortcuts
    {
      key: 'z',
      ctrl: true,
      description: 'Undo last action',
      action: () => dispatch(undo()),
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
    // View shortcuts
    {
      key: ' ',
      description: 'Toggle before/after comparison',
      action: () => dispatch(toggleComparison()),
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
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

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
