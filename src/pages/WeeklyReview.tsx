import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trophy, TrendingUp, AlertCircle, Target, Clock, Layers, Moon, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PaywallGate } from '@/components/PaywallGate';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/States';
import { StatTile } from '@/components/dashboard/StatTile';
import { BarsChart } from '@/components/charts/Charts';
import { useData } from '@/store/data';
import { buildHistory } from '@/lib/fitness/progression';
import { sessionVolume } from '@/lib/fitness/calculations';
import { goalPercent } from '@/lib/fitness/goals';
import { getExercise } from '@/data/exercises';
import { fmtWeight } from '@/lib/fitness/units';
import { addDays, DAY_SHORT, formatDate, startOfWeek, today, weekdayOf } from '@/lib/date';
import { humanDuration, pluralize, round } from '@/lib/utils';

export default function WeeklyReviewPage() {
  return (
    <PaywallGate
      feature="weekly_review"
      title="Weekly Review"
      blurb="Every week, FitHub reads your training and tells you what actually happened — not a list of numbers, but the one win worth keeping and the one opportunity worth acting on."
      bullets={[
        'Your biggest win of the week, picked from real data',
        'The clearest opportunity to improve next week',
        'Volume, consistency and recovery, side by side',
      ]}
    >
      <WeeklyReview />
    </PaywallGate>
  );
}

function WeeklyReview() {
  const sessions = useData((s) => s.sessions);
  const sets = useData((s) => s.sets);
  const recovery = useData((s) => s.recovery);
  const goals = useData((s) => s.goals);
  const records = useData((s) => s.records);
  const program = useData((s) => s.programs.find((p) => p.active) ?? null);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const weekStartsOn = useData((s) => s.preferences?.week_starts_on ?? 1);

  const [offset, setOffset] = useState(0);
  const weekStart = addDays(startOfWeek(today(), weekStartsOn), -offset * 7);
  const weekEnd = addDays(weekStart, 6);
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);

  const inWeek = useMemo(
    () => sessions.filter((s) => s.status === 'completed' && s.date >= weekStart && s.date <= weekEnd),
    [sessions, weekStart, weekEnd],
  );
  const inPrev = useMemo(
    () => sessions.filter((s) => s.status === 'completed' && s.date >= prevStart && s.date <= prevEnd),
    [sessions, prevStart, prevEnd],
  );

  const weekSets = useMemo(() => {
    const ids = new Set(inWeek.map((s) => s.id));
    return sets.filter((s) => ids.has(s.session_id) && s.completed && !s.is_warmup);
  }, [sets, inWeek]);

  const prevSets = useMemo(() => {
    const ids = new Set(inPrev.map((s) => s.id));
    return sets.filter((s) => ids.has(s.session_id) && s.completed && !s.is_warmup);
  }, [sets, inPrev]);

  const volume = sessionVolume(weekSets);
  const prevVolume = sessionVolume(prevSets);
  const minutes = Math.round(inWeek.reduce((a, s) => a + s.duration_seconds / 60, 0));
  const target = program?.days_per_week ?? 3;

  const sleepLogs = recovery.filter((r) => r.date >= weekStart && r.date <= weekEnd && r.sleep_hours !== null);
  const avgSleep = sleepLogs.length ? round(sleepLogs.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / sleepLogs.length, 1) : null;
  const prevSleepLogs = recovery.filter((r) => r.date >= prevStart && r.date <= prevEnd && r.sleep_hours !== null);
  const prevSleep = prevSleepLogs.length ? round(prevSleepLogs.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / prevSleepLogs.length, 1) : null;

  const weekRecords = records.filter((r) => {
    const d = r.achieved_at.slice(0, 10);
    return d >= weekStart && d <= weekEnd;
  });

  /* Biggest win: the exercise that improved most this week. */
  const biggestWin = useMemo(() => {
    const dates = new Map(sessions.map((s) => [s.id, s.date]));
    let best: { name: string; from: number; to: number; delta: number } | null = null;
    const slugs = [...new Set(weekSets.map((s) => s.exercise_slug))];
    for (const slug of slugs) {
      const history = buildHistory(sets.filter((s) => s.exercise_slug === slug), (id) => dates.get(id) ?? null);
      const thisWeek = history.filter((h) => h.date >= weekStart && h.date <= weekEnd);
      const before = history.filter((h) => h.date < weekStart);
      if (!thisWeek.length || !before.length) continue;
      const to = Math.max(...thisWeek.map((h) => h.best1RM ?? 0));
      const from = Math.max(...before.map((h) => h.best1RM ?? 0));
      if (to <= 0 || from <= 0) continue;
      const delta = to - from;
      if (delta > 0 && (!best || delta > best.delta)) {
        best = { name: getExercise(slug)?.name ?? slug, from: round(from, 1), to: round(to, 1), delta: round(delta, 1) };
      }
    }
    return best;
  }, [weekSets, sets, sessions, weekStart, weekEnd]);

  const strengthChange = useMemo(() => {
    if (!prevVolume || !volume) return null;
    return round(((volume - prevVolume) / prevVolume) * 100, 1);
  }, [volume, prevVolume]);

  const perDay = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const s = inWeek.find((x) => x.date === date);
        return {
          date,
          label: DAY_SHORT[weekdayOf(date)],
          minutes: s ? Math.round(s.duration_seconds / 60) : 0,
        };
      }),
    [weekStart, inWeek],
  );

  const opportunity = useMemo(() => {
    if (inWeek.length < target) {
      return `You completed ${inWeek.length} of ${target} planned sessions. Missing one week is noise; missing three in a row is a pattern worth changing — often by moving a session to a different day rather than trying harder.`;
    }
    if (avgSleep !== null && prevSleep !== null && avgSleep < prevSleep - 0.5) {
      return `Average sleep was ${avgSleep} hours, down from ${prevSleep} the week before. Sleep is usually the cheapest performance gain available.`;
    }
    if (avgSleep !== null && avgSleep < 6.5) {
      return `Average sleep was ${avgSleep} hours. Under about 6.5 hours, both strength output and recovery measurably suffer.`;
    }
    if (!recovery.some((r) => r.date >= weekStart && r.date <= weekEnd)) {
      return 'No recovery check-ins this week. Twenty seconds a day is what makes your readiness score meaningful rather than decorative.';
    }
    if (strengthChange !== null && strengthChange < -12) {
      return `Training volume fell ${Math.abs(strengthChange)}% versus last week. That is fine if it was deliberate — worth a look if it was not.`;
    }
    return 'Nothing stands out as a problem this week. The most useful thing you can do is repeat it.';
  }, [inWeek.length, target, avgSleep, prevSleep, recovery, weekStart, weekEnd, strengthChange]);

  const nextWeek = useMemo(() => {
    if (inWeek.length === 0) return 'Get one session in. Momentum beats optimisation every time.';
    if (inWeek.length >= target && (strengthChange ?? 0) >= 0) {
      return 'Continue your current training schedule. Where every set hit its rep target, add a small load increment next session.';
    }
    if (inWeek.length >= target) {
      return 'Keep the schedule but hold your loads steady for a week. Consolidating is not the same as stalling.';
    }
    return `Aim for ${target} sessions. If a particular weekday keeps getting missed, move that session rather than repeatedly failing it.`;
  }, [inWeek.length, target, strengthChange]);

  const liveGoals = goals.filter((g) => !g.archived);

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        eyebrow="Your Week in FitHub"
        title={offset === 0 ? 'This week' : `Week of ${formatDate(weekStart, 'medium')}`}
        subtitle={`${formatDate(weekStart, 'short')} – ${formatDate(weekEnd, 'short')}`}
        actions={
          <div className="flex gap-1">
            <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Previous week"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
              aria-label="Next week"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {inWeek.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers size={22} />}
            title="No sessions logged this week"
            body="Your weekly review fills in as you train. One session is enough to start producing something useful."
            action={<Button to="/workout">Today's workout</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Workouts" value={`${inWeek.length} / ${target}`} icon={<Layers size={15} />}>
              <ProgressBar value={inWeek.length} max={target} className="mt-3" height="sm" />
            </StatTile>
            <StatTile label="Workout time" value={humanDuration(minutes * 60)} icon={<Clock size={15} />}
              hint={inPrev.length ? `${Math.round(inPrev.reduce((a, s) => a + s.duration_seconds / 60, 0))} min last week` : undefined} />
            <StatTile label="Total sets" value={weekSets.length} icon={<Layers size={15} />}
              trend={prevSets.length ? weekSets.length - prevSets.length : undefined} />
            <StatTile
              label="Volume"
              value={volume > 0 ? fmtWeight(volume, units, 0) : '—'}
              icon={<TrendingUp size={15} />}
              trend={strengthChange}
              hint={strengthChange !== null ? '% vs last week' : undefined}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Training by day" />
              <div className="p-3">
                <BarsChart data={perDay} dataKey="minutes" name="Minutes" unit=" min" labelKey="label" height={200} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Recovery" subtitle={avgSleep !== null ? `${sleepLogs.length} nights logged` : 'No sleep logged'} />
              <div className="p-5 pt-2 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink-3 flex items-center gap-2"><Moon size={14} /> Average sleep</span>
                  <span className="text-2xl font-black tabular">
                    {avgSleep !== null ? `${avgSleep}h` : '—'}
                  </span>
                </div>
                {prevSleep !== null && avgSleep !== null && (
                  <p className="text-2xs text-ink-3">
                    {avgSleep > prevSleep ? '+' : ''}{round(avgSleep - prevSleep, 1)}h versus last week ({prevSleep}h)
                  </p>
                )}
                <div className="pt-2 border-t border-line">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-3">Check-ins logged</span>
                    <span className="text-lg font-bold tabular">
                      {recovery.filter((r) => r.date >= weekStart && r.date <= weekEnd).length} / 7
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-line">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-3">Average readiness</span>
                    <span className="text-lg font-bold tabular">
                      {(() => {
                        const rows = recovery.filter((r) => r.date >= weekStart && r.date <= weekEnd);
                        return rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : '—';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Biggest win */}
          <Card className={biggestWin || weekRecords.length ? 'border-brand/40' : undefined}>
            <CardHeader title="Biggest win" icon={<Trophy size={17} className="text-warn" />} />
            <div className="px-5 pb-5 pt-1">
              {biggestWin ? (
                <>
                  <p className="text-xl font-bold">{biggestWin.name}</p>
                  <p className="mt-1 text-2xl font-black tabular text-brand-text">
                    {fmtWeight(biggestWin.from, units, 0)} → {fmtWeight(biggestWin.to, units, 0)}
                  </p>
                  <p className="mt-1 text-sm text-ink-3">
                    Estimated one-rep max up {fmtWeight(biggestWin.delta, units, 1)} on your previous best.
                  </p>
                </>
              ) : weekRecords.length ? (
                <>
                  <p className="text-lg font-bold">{pluralize(weekRecords.length, 'new personal record')}</p>
                  <ul className="mt-2 space-y-1">
                    {weekRecords.slice(0, 4).map((r) => (
                      <li key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-2">{getExercise(r.exercise_slug)?.name}</span>
                        <span className="font-semibold tabular">
                          {r.unit === 'kg' ? fmtWeight(r.value, units) : `${r.value} ${r.unit}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-ink-2 leading-relaxed">
                  You showed up {pluralize(inWeek.length, 'time')} this week. Not every week produces a
                  personal record — most of them just produce the consistency that makes records possible.
                </p>
              )}
            </div>
          </Card>

          {/* Opportunity + next week */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Opportunity" icon={<AlertCircle size={17} className="text-warn" />} />
              <p className="px-5 pb-5 pt-1 text-sm text-ink-2 leading-relaxed">{opportunity}</p>
            </Card>
            <Card>
              <CardHeader title="Next week" icon={<ArrowRight size={17} className="text-brand-text" />} />
              <p className="px-5 pb-5 pt-1 text-sm text-ink-2 leading-relaxed">{nextWeek}</p>
            </Card>
          </div>

          {/* Goals */}
          {liveGoals.length > 0 && (
            <Card>
              <CardHeader title="Goal progress" icon={<Target size={17} />} />
              <ul className="px-5 pb-5 pt-1 space-y-3">
                {liveGoals.map((g) => (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="font-medium truncate">{g.title}</span>
                      <span className="tabular text-ink-3 shrink-0 ml-3">
                        {g.current_value} / {g.target_value} {g.unit}
                      </span>
                    </div>
                    <ProgressBar value={goalPercent(g)} tone={g.status === 'needs_attention' ? 'warn' : 'brand'} height="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" to="/report" iconRight={<ArrowRight size={15} />}>Monthly report</Button>
            <Button variant="outline" to="/progress">Full progress</Button>
          </div>
        </>
      )}
    </div>
  );
}
