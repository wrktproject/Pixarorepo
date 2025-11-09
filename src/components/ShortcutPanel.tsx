/**
 * ShortcutPanel Component
 * Displays keyboard shortcuts reference panel
 * Accessible via '?' key
 */

import React, { useEffect, useState } from 'react';
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts';
import './ShortcutPanel.css';

export const ShortcutPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { shortcuts } = useKeyboardShortcuts();

  useEffect(() => {
    const handleToggle = () => {
      setIsOpen((prev) => !prev);
    };

    window.addEventListener('toggle-shortcuts-panel', handleToggle);

    return () => {
      window.removeEventListener('toggle-shortcuts-panel', handleToggle);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  const categoryLabels = {
    editing: 'Editing',
    view: 'View',
    navigation: 'Navigation',
    tools: 'Tools',
  };

  return (
    <div
      className="shortcut-panel-overlay"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-panel-title"
    >
      <div
        className="shortcut-panel"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="shortcut-panel__header">
          <h2 id="shortcut-panel-title" className="shortcut-panel__title">
            Keyboard Shortcuts
          </h2>
          <button
            className="shortcut-panel__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close shortcuts panel"
          >
            ×
          </button>
        </div>

        <div className="shortcut-panel__content">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="shortcut-panel__category">
              <h3 className="shortcut-panel__category-title">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              <div className="shortcut-panel__shortcuts">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="shortcut-panel__item">
                    <span className="shortcut-panel__description">
                      {shortcut.description}
                    </span>
                    <kbd className="shortcut-panel__keys">
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcut-panel__footer">
          <p className="shortcut-panel__hint">
            Press <kbd>?</kbd> to toggle this panel • Press <kbd>Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};
