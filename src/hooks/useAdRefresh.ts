/**
 * useAdRefresh Hook
 * Manages ad refresh logic with user activity awareness
 */

import { useEffect, useRef, useState } from 'react';
import { useUserActivity } from './useUserActivity';

export interface UseAdRefreshOptions {
  refreshInterval: number; // milliseconds
  minRefreshInterval?: number; // milliseconds, default 30000 (30 seconds)
  pauseOnActivity?: boolean; // default true
  enabled?: boolean; // default true
}

export function useAdRefresh(options: UseAdRefreshOptions) {
  const {
    refreshInterval,
    minRefreshInterval = 30000, // 30 seconds minimum
    pauseOnActivity = true,
    enabled = true,
  } = options;

  const [refreshCount, setRefreshCount] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);
  const { isActive } = useUserActivity({
    inactivityThreshold: 30000, // 30 seconds
  });

  // Ensure minimum refresh interval
  const effectiveInterval = Math.max(refreshInterval, minRefreshInterval);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const scheduleRefresh = () => {
      // Clear existing timer
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }

      // Schedule next refresh
      refreshTimerRef.current = window.setTimeout(() => {
        // Check if user is active
        if (pauseOnActivity && isActive) {
          // User is active, reschedule for later
          scheduleRefresh();
        } else {
          // User is not active, trigger refresh
          setRefreshCount((prev) => prev + 1);
          scheduleRefresh();
        }
      }, effectiveInterval);
    };

    scheduleRefresh();

    return () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [enabled, effectiveInterval, pauseOnActivity, isActive]);

  return {
    refreshCount,
    isActive,
    shouldRefresh: refreshCount > 0,
  };
}
