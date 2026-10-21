import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  durationMs?: number;
}

interface NotificationState {
  toasts: ToastNotification[];
  pushToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextToast: ToastNotification = {
      id,
      durationMs: 4200,
      ...toast,
    };
    // Cap concurrent visible stack to 3 items so notifications never overwhelm UI
    set((state) => ({
      toasts: [...state.toasts.slice(-2), nextToast],
    }));
    if (nextToast.durationMs && nextToast.durationMs > 0) {
      window.setTimeout(() => {
        if (get().toasts.some((t) => t.id === id)) {
          get().dismissToast(id);
        }
      }, nextToast.durationMs);
    }
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
