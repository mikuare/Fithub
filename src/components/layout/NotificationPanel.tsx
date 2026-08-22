import { Link } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import { useData } from '@/store/data';
import { useClickOutside } from '@/lib/hooks';
import { timeAgo } from '@/lib/date';
import { Icon } from '@/components/Icon';
import { cn } from '@/lib/utils';
import type { NotificationKind } from '@/types';

const KIND_ICON: Record<NotificationKind, string> = {
  workout_reminder: 'Dumbbell', rest_reminder: 'Leaf', goal_progress: 'Target',
  achievement: 'Trophy', hydration: 'Droplets', trainer: 'UserRoundCog',
  system: 'Info', challenge: 'Flag', membership: 'IdCard',
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const notifications = useData((s) => s.notifications);
  const markRead = useData((s) => s.markNotificationsRead);
  const ref = useClickOutside<HTMLDivElement>(onClose);

  const sorted = [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30);
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div
      ref={ref}
      className="absolute right-3 sm:right-6 top-[calc(100%-6px)] w-[min(24rem,calc(100vw-1.5rem))] card shadow-lift animate-scale-in origin-top-right z-30"
      role="dialog"
      aria-label="Notifications"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <h2 className="font-semibold text-sm">Notifications</h2>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markRead()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text hover:underline"
          >
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="py-10 text-center px-6">
          <BellOff size={22} className="mx-auto text-ink-3 mb-2" />
          <p className="text-sm font-medium text-ink-2">You're all caught up</p>
          <p className="text-xs text-ink-3 mt-1">Reminders, records and goal updates will appear here.</p>
        </div>
      ) : (
        <ul className="max-h-[26rem] overflow-y-auto divide-y divide-line">
          {sorted.map((n) => {
            const Row = (
              <div className={cn('flex gap-3 px-4 py-3 hover:bg-surface-2 transition-colors', !n.read_at && 'bg-brand-soft/25')}>
                <span className="shrink-0 mt-0.5 h-8 w-8 rounded-xl bg-surface-2 border border-line grid place-items-center text-ink-2">
                  <Icon name={KIND_ICON[n.kind] ?? 'Info'} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink leading-snug">{n.title}</p>
                  {n.body && <p className="text-xs text-ink-3 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>}
                  <p className="text-2xs text-ink-3 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="shrink-0 mt-2 h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}
              </div>
            );
            return (
              <li key={n.id} onClick={() => void markRead([n.id])}>
                {n.href ? <Link to={n.href}>{Row}</Link> : Row}
              </li>
            );
          })}
        </ul>
      )}

      <div className="px-4 py-2.5 border-t border-line">
        <Link to="/settings#notifications" className="text-xs text-ink-3 hover:text-ink-2">Notification settings</Link>
      </div>
    </div>
  );
}
