import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatTile({
  label, value, unit, hint, icon, trend, to, tone = 'default', children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: number | null;
  to?: string;
  tone?: 'default' | 'brand' | 'accent';
  children?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-3">{label}</span>
        {icon && <span className="text-ink-3 shrink-0">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn('text-3xl font-black tabular leading-none', tone === 'brand' && 'text-brand-text', tone === 'accent' && 'text-accent-text')}>
          {value}
        </span>
        {unit && <span className="text-sm text-ink-3 font-medium">{unit}</span>}
      </div>
      {(hint || trend !== undefined) && (
        <div className="mt-1.5 flex items-center gap-1.5 text-2xs text-ink-3">
          {trend !== undefined && trend !== null && trend !== 0 && (
            <span className={cn('inline-flex items-center gap-0.5 font-semibold', trend > 0 ? 'text-success' : 'text-danger')}>
              {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {trend > 0 ? '+' : ''}{trend}
            </span>
          )}
          {hint}
        </div>
      )}
      {children}
    </>
  );

  const className = 'card p-4 relative group';

  if (to) {
    return (
      <Link to={to} className={cn(className, 'hover:border-line-strong transition-colors block')}>
        {body}
        <ArrowUpRight size={14} className="absolute top-4 right-4 text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
