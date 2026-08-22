import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dialog with focus trapping, escape-to-close, scroll lock and focus restore.
 * On small screens it renders as a bottom sheet, which is far easier to reach
 * one-handed mid-workout.
 */
export function Modal({
  open, onClose, title, description, children, footer, size = 'md', hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const timer = setTimeout(() => (focusable()[0] ?? panelRef.current)?.focus(), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-desc' : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-surface border border-line shadow-lift',
          'rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[86vh] flex flex-col',
          'animate-slide-up sm:animate-scale-in pb-safe',
          width,
        )}
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-bold text-ink leading-tight">{title}</h2>
            {description && <p id="modal-desc" className="text-sm text-ink-3 mt-1">{description}</p>}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 -mt-1 -mr-1 h-9 w-9 grid place-items-center rounded-xl text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="px-5 pb-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line bg-surface-2/60 shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', tone = 'danger', busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
      <div className="flex gap-2 justify-end mt-6">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-xl text-sm font-semibold border border-line text-ink hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'h-10 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50',
            tone === 'danger' ? 'bg-danger text-white hover:brightness-95' : 'bg-brand text-brand-contrast hover:brightness-95',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
