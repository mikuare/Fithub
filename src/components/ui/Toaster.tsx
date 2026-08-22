import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, Trophy, X } from 'lucide-react';
import { useToasts, type ToastTone } from '@/store/toast';
import { cn } from '@/lib/utils';

const ICONS: Record<ToastTone, typeof Info> = {
  default: Info, success: CheckCircle2, warn: AlertTriangle, danger: XCircle, brand: Trophy,
};

const STYLES: Record<ToastTone, string> = {
  default: 'border-line',
  success: 'border-success/40',
  warn: 'border-warn/40',
  danger: 'border-danger/40',
  brand: 'border-brand/50',
};

const ICON_COLOR: Record<ToastTone, string> = {
  default: 'text-ink-3', success: 'text-success', warn: 'text-warn', danger: 'text-danger', brand: 'text-brand-text',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();

  useEffect(() => {
    if (!toasts.length) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(toasts[toasts.length - 1].id); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toasts, dismiss]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[60] bottom-20 sm:bottom-5 right-3 left-3 sm:left-auto sm:right-5 sm:w-96 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto glass border rounded-2xl shadow-lift p-3.5 flex items-start gap-3 animate-fade-up',
              STYLES[t.tone],
            )}
          >
            <Icon size={18} className={cn('shrink-0 mt-0.5', ICON_COLOR[t.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink leading-snug">{t.title}</p>
              {t.body && <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{t.body}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => { t.action?.onClick?.(); dismiss(t.id); }}
                  className="mt-2 text-xs font-semibold text-brand-text hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 -mt-0.5 -mr-0.5 h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
