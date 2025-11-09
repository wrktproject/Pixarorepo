/**
 * WebGL Warning Component
 * Displays warnings about WebGL support and performance
 */

import { useState } from 'react';
import './WebGLWarning.css';

interface WebGLWarningProps {
  message: string;
  severity?: 'warning' | 'error';
  dismissible?: boolean;
}

export function WebGLWarning({
  message,
  severity = 'warning',
  dismissible = true,
}: WebGLWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`webgl-warning webgl-warning--${severity}`}
      role="alert"
      aria-live="polite"
    >
      <div className="webgl-warning__icon">
        {severity === 'error' ? '⚠️' : 'ℹ️'}
      </div>
      <div className="webgl-warning__content">
        <p className="webgl-warning__message">{message}</p>
        <p className="webgl-warning__details">
          {severity === 'error'
            ? 'Some features may not work correctly. Please try using a modern browser with WebGL support.'
            : 'Performance may be reduced. For the best experience, use a browser with WebGL 2 support.'}
        </p>
      </div>
      {dismissible && (
        <button
          className="webgl-warning__dismiss"
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss warning"
        >
          ×
        </button>
      )}
    </div>
  );
}
