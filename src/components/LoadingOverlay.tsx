/**
 * Loading Overlay Component
 * Full-screen or inline overlay with loading indicator
 */

import { LoadingSpinner } from './LoadingSpinner';
import { ProgressBar } from './ProgressBar';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100, if provided shows progress bar instead of spinner
  estimatedTime?: number; // in seconds
  fullScreen?: boolean;
}

export function LoadingOverlay({
  isLoading,
  message,
  progress,
  estimatedTime,
  fullScreen = false,
}: LoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  const content = (
    <div className="loading-overlay__content">
      {progress !== undefined ? (
        <ProgressBar
          progress={progress}
          message={message}
          estimatedTime={estimatedTime}
        />
      ) : (
        <LoadingSpinner message={message} size="large" />
      )}
    </div>
  );

  return (
    <div
      className={`loading-overlay ${
        fullScreen ? 'loading-overlay--fullscreen' : 'loading-overlay--inline'
      }`}
    >
      {content}
    </div>
  );
}
