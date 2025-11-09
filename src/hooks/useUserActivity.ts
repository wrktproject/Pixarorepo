/**
 * useUserActivity Hook
 * Tracks user activity (mouse/keyboard input) to determine if user is actively editing
 */

import { useEffect, useRef, useState } from 'react';

export interface UseUserActivityOptions {
  inactivityThreshold?: number; // milliseconds, default 30000 (30 seconds)
  checkInterval?: number; // milliseconds, default 1000 (1 second)
}

export function useUserActivity(options: UseUserActivityOptions = {}) {
  const {
    inactivityThreshold = 30000, // 30 seconds
    checkInterval = 1000, // 1 second
  } = options;

  const lastActivityRef = useRef<number>(Date.now());
  const [isActive, setIsActive] = useState(true);

  // Track user activity
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (!isActive) {
        setIsActive(true);
      }
    };

    // Listen for various user input events
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive]);

  // Check activity status periodically
  useEffect(() => {
    const checkActivity = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const shouldBeActive = timeSinceActivity < inactivityThreshold;

      if (shouldBeActive !== isActive) {
        setIsActive(shouldBeActive);
      }
    };

    const intervalId = setInterval(checkActivity, checkInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [inactivityThreshold, checkInterval, isActive]);

  return {
    isActive,
    lastActivityTime: lastActivityRef.current,
    timeSinceActivity: Date.now() - lastActivityRef.current,
  };
}
