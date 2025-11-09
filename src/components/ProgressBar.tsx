/**
 * Progress Bar Component
 * Displays a progress bar with percentage and optional estimated time
 */

import './ProgressBar.css';

interface ProgressBarProps {
  progress: number; // 0-100
  message?: string;
  estimatedTime?: number; // in seconds
  showPercentage?: boolean;
}

export function ProgressBar({
  progress,
  message,
  estimatedTime,
  showPercentage = true,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="progress-bar">
      {message && (
        <div className="progress-bar__header">
          <span className="progress-bar__message">{message}</span>
          {estimatedTime !== undefined && estimatedTime > 0 && (
            <span className="progress-bar__time">
              ~{formatTime(estimatedTime)} remaining
            </span>
          )}
        </div>
      )}
      <div className="progress-bar__track">
        <div
          className="progress-bar__fill"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showPercentage && (
        <div className="progress-bar__percentage">{Math.round(clampedProgress)}%</div>
      )}
    </div>
  );
}
