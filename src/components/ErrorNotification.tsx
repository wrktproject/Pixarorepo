/**
 * Error Notification Component
 * Displays user-friendly error messages and fallback status
 * Requirement 10.5: Display user-friendly error messages
 */

import { useEffect, useState } from 'react';
import type { PixaroError } from '../types/errors';
import type { RenderMode } from '../engine/shaderPipelineErrorHandler';
import styles from './ErrorNotification.module.css';

export interface ErrorNotificationProps {
  error: PixaroError | null;
  renderMode: RenderMode;
  onDismiss?: () => void;
  autoHideDuration?: number; // ms, 0 = no auto-hide
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  renderMode,
  onDismiss,
  autoHideDuration = 5000,
}) => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (error && !dismissed) {
      setVisible(true);

      // Auto-hide for non-fatal errors
      if (autoHideDuration > 0 && error.severity !== 'fatal') {
        const timer = setTimeout(() => {
          setVisible(false);
        }, autoHideDuration);

        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [error, dismissed, autoHideDuration]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!visible || !error) {
    return null;
  }

  const getSeverityClass = () => {
    switch (error.severity) {
      case 'fatal':
        return styles.fatal;
      case 'error':
        return styles.error;
      case 'warning':
        return styles.warning;
      default:
        return styles.info;
    }
  };

  const getSeverityIcon = () => {
    switch (error.severity) {
      case 'fatal':
        return '⛔';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getRenderModeMessage = () => {
    if (renderMode === 'canvas2d') {
      return (
        <div className={styles.fallbackInfo}>
          <span className={styles.fallbackIcon}>🔄</span>
          <span>Using simplified rendering mode. Some effects may be unavailable.</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`${styles.notification} ${getSeverityClass()}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            {getSeverityIcon()}
          </span>
          <span className={styles.title}>
            {error.severity === 'fatal' ? 'Critical Error' : 'Error'}
          </span>
        </div>
        
        <div className={styles.message}>
          {error.userMessage}
        </div>

        {getRenderModeMessage()}

        {error.recoverable && (
          <div className={styles.recovery}>
            The application will continue with reduced functionality.
          </div>
        )}
      </div>

      {error.severity !== 'fatal' && (
        <button
          className={styles.dismissButton}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </div>
  );
};
