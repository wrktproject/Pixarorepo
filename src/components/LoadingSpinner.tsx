/**
 * Loading Spinner Component
 * Displays a loading spinner with optional message
 */

import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingSpinner({ message, size = 'medium' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner">
      <div className={`loading-spinner__spinner loading-spinner__spinner--${size}`}>
        <div className="loading-spinner__circle"></div>
      </div>
      {message && <p className="loading-spinner__message">{message}</p>}
    </div>
  );
}
