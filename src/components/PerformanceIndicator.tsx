/**
 * Performance Indicator Component
 * Displays FPS and performance warnings when rendering is slow
 * Requirement 13.4: Add performance indicator for low FPS
 */

import { useEffect, useState } from 'react';
import type { PerformanceStats } from '../engine/renderScheduler';
import styles from './PerformanceIndicator.module.css';

interface PerformanceIndicatorProps {
  stats: PerformanceStats | null;
  showDetails?: boolean; // Show detailed stats (FPS, frame time, etc.)
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  stats,
  showDetails = false,
  position = 'top-right',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Show indicator when performance is low or when details are requested
  useEffect(() => {
    if (!stats) {
      setIsVisible(false);
      return;
    }

    setIsVisible(showDetails || stats.isLowPerformance);
  }, [stats, showDetails]);

  if (!isVisible || !stats) {
    return null;
  }

  const getFPSColor = (fps: number): string => {
    if (fps >= 50) return 'good';
    if (fps >= 30) return 'warning';
    return 'critical';
  };

  const fpsColor = getFPSColor(stats.currentFPS);

  return (
    <div
      className={`${styles.container} ${styles[position]} ${styles[fpsColor]}`}
      role="status"
      aria-live="polite"
      aria-label={`Performance: ${Math.round(stats.currentFPS)} FPS`}
    >
      {/* FPS Display */}
      <div className={styles.fps}>
        <span className={styles.fpsValue}>{Math.round(stats.currentFPS)}</span>
        <span className={styles.fpsLabel}>FPS</span>
      </div>

      {/* Low Performance Warning */}
      {stats.isLowPerformance && (
        <div className={styles.warning}>
          <svg
            className={styles.warningIcon}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M8 1L1 14h14L8 1z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 6v3M8 11h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.warningText}>Slow rendering</span>
        </div>
      )}

      {/* Detailed Stats */}
      {showDetails && (
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Avg FPS:</span>
            <span className={styles.detailValue}>{Math.round(stats.averageFPS)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Frame Time:</span>
            <span className={styles.detailValue}>{stats.lastFrameTime.toFixed(1)}ms</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Avg Frame Time:</span>
            <span className={styles.detailValue}>{stats.averageFrameTime.toFixed(1)}ms</span>
          </div>
          {stats.droppedFrames > 0 && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Dropped:</span>
              <span className={styles.detailValue}>
                {stats.droppedFrames} / {stats.totalFrames}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
