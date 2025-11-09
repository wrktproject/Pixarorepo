/**
 * CollapsibleSection Component
 * Accordion-style section container for organizing adjustment controls
 */

import React, { useState, useCallback } from 'react';
import './CollapsibleSection.css';

export interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  expanded,
  disabled = false,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Use controlled expansion if provided
  const actualExpanded = expanded !== undefined ? expanded : isExpanded;

  const handleToggle = useCallback(() => {
    const newExpanded = !actualExpanded;
    if (expanded === undefined) {
      setIsExpanded(newExpanded);
    }
    onToggle?.(newExpanded);
  }, [actualExpanded, expanded, onToggle]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  return (
    <div className="collapsible-section">
      <button
        className="collapsible-section__header"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={actualExpanded}
        aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        disabled={disabled}
      >
        <span className="collapsible-section__title">{title}</span>
        <svg
          className={`collapsible-section__icon ${actualExpanded ? 'collapsible-section__icon--expanded' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 10 5 14 9" />
        </svg>
      </button>
      <div
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className={`collapsible-section__content ${actualExpanded ? 'collapsible-section__content--expanded' : ''}`}
        aria-hidden={!actualExpanded}
      >
        <div className="collapsible-section__inner">{children}</div>
      </div>
    </div>
  );
};
