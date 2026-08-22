import { useMemo, useState } from 'react';
import { Award, Lock, Flame, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Tabs } from '@/components/ui/Tabs';
import { StatTile } from '@/components/dashboard/StatTile';
import { Icon } from '@/components/Icon';
import { useAchievementProgress, useStreak } from '@/lib/selectors';
import { useData } from '@/store/data';
import { ACHIEVEMENTS } from '@/data/achievements';
import { relativeDay } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { AchievementDef } from '@/types';

const TIER_STYLE: Record<AchievementDef['tier'], { ring: string; chip: 'warn' | 'muted' | 'info' }> = {
  bronze: { ring: 'text-warn', chip: 'warn' },
  silver: { ring: 'text-info', chip: 'info' },
  gold: { ring: 'text-brand-text', chip: 'muted' },
};

export default function Achievements() {
  const progress = useAchievementProgress();
  const earnedRows = useData((s) => s.achievements);
  const streak = useStreak();
  const sessions = useData((s) => s.sessions);
  const [category, setCategory] = useState<'all' | AchievementDef['category']>('all');

  const byId = useMemo(() => new Map(progress.map((p) => [p.id, p])), [progress]);
  const earnedCount = progress.filter((p) => p.earned).length;

  const filtered = useMemo(
    () => ACHIEVEMENTS.filter((a) => category === 'all' || a.category === category),
    [category],
  );

  const monthCount = sessions.filter(
    (s) => s.status === 'completed' && s.date.slice(0, 7) === new Date().toISOString().slice(0, 7),
  ).length;

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Achievements"
        title="Milestones worth marking"
        subtitle="These reward showing up, improving and recovering — never appearance or bodyweight. Nothing here expires or resets."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Unlocked" value={earnedCount} unit={`/ ${ACHIEVEMENTS.length}`} icon={<Award size={15} />} tone="brand">
          <ProgressBar value={earnedCount} max={ACHIEVEMENTS.length} className="mt-3" height="sm" />
        </StatTile>
        <StatTile label="Current streak" value={streak.current} unit="days" icon={<Flame size={15} />}
          hint={streak.longest > streak.current ? `best ${streak.longest}` : 'your best yet'} />
        <StatTile label="This month" value={monthCount} unit="workouts" icon={<Trophy size={15} />} />
        <StatTile label="Consistent weeks" value={streak.consistent_weeks} icon={<Award size={15} />}
          hint="weeks meeting your target in a row" />
      </div>

      <Tabs
        value={category}
        onChange={(k) => setCategory(k as typeof category)}
        items={[
          { key: 'all', label: 'All', count: ACHIEVEMENTS.length },
          { key: 'consistency', label: 'Consistency' },
          { key: 'strength', label: 'Strength' },
          { key: 'cardio', label: 'Cardio' },
          { key: 'recovery', label: 'Recovery' },
          { key: 'habits', label: 'Habits' },
          { key: 'milestone', label: 'Milestones' },
        ]}
      />

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((a) => {
          const p = byId.get(a.id);
          const earnedRow = earnedRows.find((r) => r.achievement_id === a.id && r.earned_at);
          const earned = p?.earned ?? false;
          const pct = Math.round((p?.progress ?? 0) * 100);
          return (
            <li key={a.id}>
              <Card className={cn('h-full transition-colors', earned && 'border-brand/40 bg-brand-soft/20')}>
                <div className="p-4 flex gap-3.5">
                  <div className="shrink-0">
                    <ProgressRing
                      value={pct} size={54} stroke={4}
                      tone={earned ? 'brand' : 'info'}
                      label={`${a.name}, ${pct} percent`}
                    >
                      <span className={cn(earned ? TIER_STYLE[a.tier].ring : 'text-ink-3')}>
                        {earned ? <Icon name={a.icon} size={18} /> : <Lock size={15} />}
                      </span>
                    </ProgressRing>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className={cn('font-semibold text-sm leading-snug', !earned && 'text-ink-2')}>{a.name}</h3>
                      <Badge size="sm" tone={earned ? TIER_STYLE[a.tier].chip : 'muted'} className="ml-auto shrink-0 capitalize">
                        {a.tier}
                      </Badge>
                    </div>
                    <p className="mt-1 text-2xs text-ink-3 leading-relaxed">{a.description}</p>
                    <p className={cn('mt-2 text-2xs tabular font-medium', earned ? 'text-brand-text' : 'text-ink-3')}>
                      {earned
                        ? earnedRow?.earned_at ? `Unlocked ${relativeDay(earnedRow.earned_at.slice(0, 10)).toLowerCase()}` : 'Unlocked'
                        : p?.detail ?? '—'}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardHeader title="How streaks work here" dense />
        <p className="px-4 pb-4 pt-1 text-sm text-ink-2 leading-relaxed">
          A day counts toward your streak if you trained, <strong>or</strong> if that weekday is a scheduled
          rest or recovery day in your programme. Punishing people for taking the rest day their own plan
          prescribes pushes them toward exactly the behaviour this product exists to discourage.
        </p>
      </Card>
    </div>
  );
}
