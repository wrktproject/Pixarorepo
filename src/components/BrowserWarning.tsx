/**
 * BrowserWarning Component
 * Displays a warning banner for unsupported browsers
 */

import { useState } from 'react';
import './BrowserWarning.css';

export interface BrowserWarningProps {
  message: string;
  severity: 'warning' | 'error';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function BrowserWarning({
  message,
  severity,
  dismissible = true,
  onDismiss,
}: BrowserWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`browser-warning browser-warning--${severity}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="browser-warning__content">
        <div className="browser-warning__icon" aria-hidden="true">
          {severity === 'error' ? '⚠️' : 'ℹ️'}
        </div>
        <div className="browser-warning__message">{message}</div>
        {dismissible && (
          <button
            className="browser-warning__dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss warning"
            type="button"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
