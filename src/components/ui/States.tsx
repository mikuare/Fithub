import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon, title, body, action, secondary, compact,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  secondary?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('text-center', compact ? 'py-8 px-4' : 'py-14 px-6')}>
      {icon && (
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-2 border border-line grid place-items-center text-ink-3">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-ink">{title}</h3>
      {body && <p className="text-sm text-ink-3 mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-6 text-center border-danger/30" role="alert">
      <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-danger-soft grid place-items-center text-danger">
        <AlertTriangle size={22} />
      </div>
      <h3 className="font-semibold text-ink">Something went wrong</h3>
      <p className="text-sm text-ink-3 mt-1.5 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" icon={<RefreshCw size={14} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingScreen({ label = 'Loading FitHub' }: { label?: string }) {
  return (
    <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-brand grid place-items-center animate-pop">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-brand-contrast))" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
          </svg>
        </div>
        <p className="mt-4 text-sm text-ink-3">{label}…</p>
      </div>
    </div>
  );
}
