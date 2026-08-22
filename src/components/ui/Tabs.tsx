import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export function Tabs({
  items, value, onChange, className, fill,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  fill?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = items.findIndex((i) => i.key === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = e.key === 'ArrowRight' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      onChange(items[next].key);
      ref.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
    }
  };

  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn('flex w-full max-w-full gap-1 overflow-x-auto overscroll-x-contain p-1 bg-surface-2 border border-line rounded-2xl no-scrollbar', className)}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={cn(
              'relative flex items-center justify-center gap-2 h-9 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
              fill && 'flex-1',
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span className={cn('tabular text-2xs px-1.5 py-0.5 rounded-full', active ? 'bg-brand-soft text-brand-text' : 'bg-surface-3 text-ink-3')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options, value, onChange, size = 'md', className,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex p-0.5 bg-surface-2 border border-line rounded-xl', className)} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg font-medium transition-all whitespace-nowrap',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
