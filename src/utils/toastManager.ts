/**
 * Toast Manager
 * Centralized toast notification management
 */

import type { ToastData, ToastType } from '../components/Toast';

type ToastListener = (toasts: ToastData[]) => void;

class ToastManager {
  private toasts: ToastData[] = [];
  private listeners: Set<ToastListener> = new Set();
  private nextId = 0;

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(type: ToastType, message: string, duration?: number): string {
    const id = `toast-${this.nextId++}`;
    const toast: ToastData = {
      id,
      type,
      message,
      duration,
    };

    this.toasts.push(toast);
    this.notify();

    return id;
  }

  success(message: string, duration?: number): string {
    return this.show('success', message, duration);
  }

  error(message: string, duration?: number): string {
    return this.show('error', message, duration);
  }

  warning(message: string, duration?: number): string {
    return this.show('warning', message, duration);
  }

  info(message: string, duration?: number): string {
    return this.show('info', message, duration);
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
    this.notify();
  }

  clear(): void {
    this.toasts = [];
    this.notify();
  }
}

export const toastManager = new ToastManager();
