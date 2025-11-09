/**
 * useToast Hook
 * React hook for managing toast notifications
 */

import { useEffect, useState } from 'react';
import { toastManager } from '../utils/toastManager';
import type { ToastData } from '../components/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return unsubscribe;
  }, []);

  return {
    toasts,
    showToast: toastManager.show.bind(toastManager),
    success: toastManager.success.bind(toastManager),
    error: toastManager.error.bind(toastManager),
    warning: toastManager.warning.bind(toastManager),
    info: toastManager.info.bind(toastManager),
    removeToast: toastManager.remove.bind(toastManager),
    clearToasts: toastManager.clear.bind(toastManager),
  };
}
