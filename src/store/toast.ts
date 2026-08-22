import { create } from 'zustand';
import { uid } from '@/lib/id';

export type ToastTone = 'default' | 'success' | 'warn' | 'danger' | 'brand';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
  icon?: string;
  duration: number;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid('toast');
    const toast: Toast = { id, tone: t.tone ?? 'default', duration: t.duration ?? 4200, ...t };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-4) }));
    if (toast.duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'success' }),
  error: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'danger', duration: 6000 }),
  warn: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'warn' }),
  info: (title: string, body?: string) => useToasts.getState().push({ title, body }),
  brand: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'brand' }),
};
