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
  onToggle?: (expanded: boolean) => void;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  }, [isExpanded, onToggle]);

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
        aria-expanded={isExpanded}
        aria-controls={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="collapsible-section__title">{title}</span>
        <svg
          className={`collapsible-section__icon ${isExpanded ? 'collapsible-section__icon--expanded' : ''}`}
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
        className={`collapsible-section__content ${isExpanded ? 'collapsible-section__content--expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="collapsible-section__inner">{children}</div>
      </div>
    </div>
  );
};
