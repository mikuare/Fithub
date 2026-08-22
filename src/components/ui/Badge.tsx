import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'default' | 'brand' | 'accent' | 'success' | 'warn' | 'danger' | 'info' | 'muted';

const TONES: Record<Tone, string> = {
  default: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-soft text-brand-text border-brand/30',
  accent: 'bg-accent-soft text-accent-text border-accent/30',
  success: 'bg-success-soft text-success border-success/30',
  warn: 'bg-warn-soft text-warn border-warn/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-info-soft text-info border-info/30',
  muted: 'bg-surface-2 text-ink-3 border-line',
};

export function Badge({
  tone = 'default', children, icon, className, size = 'md',
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        TONES[tone], className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Status is always carried by a shape + text label as well as colour, so it
 * survives a colour-blind reader or a greyscale print.
 */
export function StatusDot({ tone = 'default', label, className }: { tone?: Tone; label: string; className?: string }) {
  const dot: Record<Tone, string> = {
    default: 'bg-ink-3', brand: 'bg-brand', accent: 'bg-accent', success: 'bg-success',
    warn: 'bg-warn', danger: 'bg-danger', info: 'bg-info', muted: 'bg-ink-3',
  };
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', dot[tone])} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
