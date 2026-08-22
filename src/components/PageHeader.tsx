import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-brand-text">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">{title}</h1>
        {subtitle && <div className="text-sm text-ink-3 mt-1.5 leading-relaxed max-w-2xl">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
