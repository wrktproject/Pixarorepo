/**
 * ProcessingIndicator Component
 * Shows visual feedback when image is being processed
 */

import React from 'react';
import './ProcessingIndicator.css';

export interface ProcessingIndicatorProps {
  isProcessing: boolean;
  message?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isProcessing,
  message = 'Processing...',
}) => {
  if (!isProcessing) return null;

  return (
    <div className="processing-indicator" role="status" aria-live="polite">
      <div className="processing-indicator__spinner">
        <div className="processing-indicator__circle" />
      </div>
      <span className="processing-indicator__message">{message}</span>
    </div>
  );
};
