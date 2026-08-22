import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { clamp } from '@/lib/utils';

export function ProgressBar({
  value, max = 100, tone = 'brand', className, showLabel, label, height = 'md',
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'accent' | 'success' | 'warn' | 'danger' | 'info';
  className?: string;
  showLabel?: boolean;
  label?: string;
  height?: 'sm' | 'md' | 'lg';
}) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100);
  const fill = {
    brand: 'bg-brand', accent: 'bg-accent', success: 'bg-success',
    warn: 'bg-warn', danger: 'bg-danger', info: 'bg-info',
  }[tone];
  const h = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }[height];

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between items-baseline mb-1.5 text-xs">
          <span className="text-ink-3">{label}</span>
          {showLabel && <span className="tabular font-semibold text-ink-2">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        className={cn('w-full rounded-full bg-surface-3 overflow-hidden', h)}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({
  value, max = 100, size = 120, stroke = 10, tone = 'brand', children, trackClassName, label,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: 'brand' | 'accent' | 'success' | 'warn' | 'danger' | 'info';
  children?: ReactNode;
  trackClassName?: string;
  label?: string;
}) {
  const pct = clamp((value / (max || 1)) * 100, 0, 100);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color = {
    brand: 'rgb(var(--c-brand))', accent: 'rgb(var(--c-accent))', success: 'rgb(var(--c-success))',
    warn: 'rgb(var(--c-warn))', danger: 'rgb(var(--c-danger))', info: 'rgb(var(--c-info))',
  }[tone];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label ?? `${Math.round(pct)} percent`}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className={cn('stroke-surface-3', trackClassName)}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke={color} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
