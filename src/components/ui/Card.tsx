import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card overflow-hidden', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title, subtitle, action, icon, className, dense,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', dense ? 'px-4 pt-4' : 'px-5 pt-5', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="shrink-0 mt-0.5 text-ink-3">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-ink leading-tight truncate">{title}</h3>
          {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...rest}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-3.5 border-t border-line bg-surface-2/50', className)}>{children}</div>;
}
