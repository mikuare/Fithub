import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileBarChart, Trophy, Scale } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PaywallGate } from '@/components/PaywallGate';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { BarsChart } from '@/components/charts/Charts';
import { useData } from '@/store/data';
import { sessionVolume } from '@/lib/fitness/calculations';
import { getExercise } from '@/data/exercises';
import { fmtWeight, displayWeight, weightUnit } from '@/lib/fitness/units';
import { addMonths, endOfMonth, MONTH_NAMES, fromISODate, startOfMonth, today } from '@/lib/date';
import { cn, humanDuration, pluralize, round } from '@/lib/utils';
import type { ISODate } from '@/types';

interface MonthStats {
  workouts: number;
  minutes: number;
  sets: number;
  volume: number;
  records: number;
  cardioSessions: number;
  cardioKm: number;
  avgReadiness: number | null;
  avgSleep: number | null;
  weight: number | null;
  goalsAchieved: number;
  activeDays: number;
}

export default function MonthlyReportPage() {
  return (
    <PaywallGate
      feature="monthly_report"
      title="Monthly Report"
      blurb="A month-over-month picture of your training: what went up, what went down, and whether this month beat the last one where it counts."
      bullets={[
        'Month-over-month volume, sessions and records',
        'Strength trend across your main lifts',
        'Recovery and habit consistency for the month',
      ]}
    >
      <MonthlyReport />
    </PaywallGate>
  );
}

function MonthlyReport() {
  const sessions = useData((s) => s.sessions);
  const sets = useData((s) => s.sets);
  const recovery = useData((s) => s.recovery);
  const records = useData((s) => s.records);
  const goals = useData((s) => s.goals);
  const measurements = useData((s) => s.measurements);
  const units = useData((s) => s.preferences?.units ?? 'metric');

  const [offset, setOffset] = useState(0);
  const monthStart = addMonths(startOfMonth(today()), -offset);
  const monthEnd = endOfMonth(monthStart);
  const prevStart = addMonths(monthStart, -1);
  const prevEnd = endOfMonth(prevStart);

  const statsFor = (start: ISODate, end: ISODate): MonthStats => {
    const monthSessions = sessions.filter((s) => s.status === 'completed' && s.date >= start && s.date <= end);
    const ids = new Set(monthSessions.map((s) => s.id));
    const monthSets = sets.filter((s) => ids.has(s.session_id) && s.completed && !s.is_warmup);
    const cardio = monthSessions.filter((s) => s.kind === 'cardio' || s.kind === 'recovery');
    const rec = recovery.filter((r) => r.date >= start && r.date <= end);
    const sleepRows = rec.filter((r) => r.sleep_hours !== null);
    const weights = measurements.filter((m) => m.date >= start && m.date <= end && m.weight_kg !== null)
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      workouts: monthSessions.length,
      minutes: Math.round(monthSessions.reduce((a, s) => a + s.duration_seconds / 60, 0)),
      sets: monthSets.length,
      volume: sessionVolume(monthSets),
      records: records.filter((r) => {
        const d = r.achieved_at.slice(0, 10);
        return d >= start && d <= end;
      }).length,
      cardioSessions: cardio.length,
      cardioKm: round(monthSets.reduce((a, s) => a + (s.distance_km ?? 0), 0), 1),
      avgReadiness: rec.length ? Math.round(rec.reduce((a, r) => a + r.score, 0) / rec.length) : null,
      avgSleep: sleepRows.length ? round(sleepRows.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / sleepRows.length, 1) : null,
      weight: weights[0]?.weight_kg ?? null,
      goalsAchieved: goals.filter((g) => g.achieved_at && g.achieved_at.slice(0, 10) >= start && g.achieved_at.slice(0, 10) <= end).length,
      activeDays: new Set(monthSessions.map((s) => s.date)).size,
    };
  };

  const current = useMemo(() => statsFor(monthStart, monthEnd), [monthStart, monthEnd, sessions, sets, recovery, records, goals, measurements]); // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useMemo(() => statsFor(prevStart, prevEnd), [prevStart, prevEnd, sessions, sets, recovery, records, goals, measurements]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthDate = fromISODate(monthStart);
  const label = `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const prevLabel = `${MONTH_NAMES[fromISODate(prevStart).getMonth()]}`;

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== 'completed' || s.date < monthStart || s.date > monthEnd) continue;
      map.set(s.date, (map.get(s.date) ?? 0) + Math.round(s.duration_seconds / 60));
    }
    const days: Array<{ label: string; minutes: number }> = [];
    const total = fromISODate(monthEnd).getDate();
    for (let d = 1; d <= total; d++) {
      const date = `${monthStart.slice(0, 8)}${String(d).padStart(2, '0')}`;
      days.push({ label: String(d), minutes: map.get(date) ?? 0 });
    }
    return days;
  }, [sessions, monthStart, monthEnd]);

  const rows: Array<{ label: string; now: string; then: string; delta: number | null; goodIsUp: boolean }> = [
    { label: 'Workouts completed', now: String(current.workouts), then: String(previous.workouts), delta: current.workouts - previous.workouts, goodIsUp: true },
    { label: 'Active days', now: String(current.activeDays), then: String(previous.activeDays), delta: current.activeDays - previous.activeDays, goodIsUp: true },
    { label: 'Training time', now: humanDuration(current.minutes * 60), then: humanDuration(previous.minutes * 60), delta: current.minutes - previous.minutes, goodIsUp: true },
    { label: 'Working sets', now: String(current.sets), then: String(previous.sets), delta: current.sets - previous.sets, goodIsUp: true },
    { label: 'Total volume', now: current.volume ? fmtWeight(current.volume, units, 0) : '—', then: previous.volume ? fmtWeight(previous.volume, units, 0) : '—', delta: current.volume - previous.volume, goodIsUp: true },
    { label: 'Cardio sessions', now: String(current.cardioSessions), then: String(previous.cardioSessions), delta: current.cardioSessions - previous.cardioSessions, goodIsUp: true },
    { label: 'Distance covered', now: current.cardioKm ? `${current.cardioKm} km` : '—', then: previous.cardioKm ? `${previous.cardioKm} km` : '—', delta: current.cardioKm - previous.cardioKm, goodIsUp: true },
    { label: 'Personal records', now: String(current.records), then: String(previous.records), delta: current.records - previous.records, goodIsUp: true },
    { label: 'Average readiness', now: current.avgReadiness !== null ? `${current.avgReadiness} / 100` : 'Not logged', then: previous.avgReadiness !== null ? `${previous.avgReadiness}` : '—', delta: current.avgReadiness !== null && previous.avgReadiness !== null ? current.avgReadiness - previous.avgReadiness : null, goodIsUp: true },
    { label: 'Average sleep', now: current.avgSleep !== null ? `${current.avgSleep} h` : 'Not logged', then: previous.avgSleep !== null ? `${previous.avgSleep} h` : '—', delta: current.avgSleep !== null && previous.avgSleep !== null ? round(current.avgSleep - previous.avgSleep, 1) : null, goodIsUp: true },
    { label: 'Body weight', now: current.weight !== null ? `${displayWeight(current.weight, units)} ${weightUnit(units)}` : 'Not logged', then: previous.weight !== null ? `${displayWeight(previous.weight, units)}` : '—', delta: current.weight !== null && previous.weight !== null ? round(displayWeight(current.weight, units)! - displayWeight(previous.weight, units)!, 1) : null, goodIsUp: false },
    { label: 'Goals achieved', now: String(current.goalsAchieved), then: String(previous.goalsAchieved), delta: current.goalsAchieved - previous.goalsAchieved, goodIsUp: true },
  ];

  const monthRecords = records.filter((r) => {
    const d = r.achieved_at.slice(0, 10);
    return d >= monthStart && d <= monthEnd;
  });

  const summary = useMemo(() => {
    if (current.workouts === 0) return 'Nothing logged this month yet.';
    const parts: string[] = [];
    parts.push(`You trained on ${pluralize(current.activeDays, 'day')} this month, ${current.workouts} sessions totalling ${humanDuration(current.minutes * 60)}.`);
    if (previous.workouts > 0) {
      const diff = current.workouts - previous.workouts;
      parts.push(
        diff > 0 ? `That is ${diff} more than ${prevLabel}.`
          : diff < 0 ? `That is ${Math.abs(diff)} fewer than ${prevLabel} — worth understanding why before changing anything else.`
          : `Exactly the same as ${prevLabel}, which is its own kind of win.`,
      );
    }
    if (current.records > 0) parts.push(`You set ${pluralize(current.records, 'personal record')}.`);
    if (current.avgSleep !== null && current.avgSleep >= 7) parts.push('Sleep averaged seven hours or more, which shows up in everything else.');
    if (current.workouts >= 12) parts.push('This is the kind of month that compounds — the results people notice come from stringing several of these together.');
    else if (current.workouts >= 6) parts.push('A solid base. The next step is simply another month like it.');
    return parts.join(' ');
  }, [current, previous, prevLabel]);

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        eyebrow="Monthly Progress Report"
        title={label}
        subtitle={`Compared against ${prevLabel}`}
        actions={
          <div className="flex gap-1">
            <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Previous month"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0}
              aria-label="Next month"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {current.workouts === 0 ? (
        <Card>
          <EmptyState
            icon={<FileBarChart size={22} />}
            title={`Nothing logged in ${label}`}
            body="Monthly reports compare this month against the last one. They become useful after a few weeks of training."
            action={<Button to="/workout">Today's workout</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="border-brand/30">
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-text">Summary</p>
              <p className="mt-2 text-base text-ink-2 leading-relaxed">{summary}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="This month vs last month" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Month-over-month comparison</caption>
                <thead className="text-2xs uppercase tracking-wider text-ink-3">
                  <tr className="border-b border-line">
                    <th scope="col" className="text-left font-semibold px-5 py-2.5">Metric</th>
                    <th scope="col" className="text-right font-semibold px-3 py-2.5">{label.split(' ')[0]}</th>
                    <th scope="col" className="text-right font-semibold px-3 py-2.5">{prevLabel}</th>
                    <th scope="col" className="text-right font-semibold px-5 py-2.5">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const improved = r.delta === null ? null : r.goodIsUp ? r.delta > 0 : r.delta < 0;
                    return (
                      <tr key={r.label} className="hover:bg-surface-2">
                        <th scope="row" className="text-left font-medium px-5 py-2.5">{r.label}</th>
                        <td className="text-right px-3 tabular font-semibold">{r.now}</td>
                        <td className="text-right px-3 tabular text-ink-3">{r.then}</td>
                        <td className="text-right px-5">
                          {r.delta === null || r.delta === 0 ? (
                            <span className="inline-flex items-center gap-1 text-ink-3 tabular"><Minus size={12} /> —</span>
                          ) : (
                            <span className={cn('inline-flex items-center gap-1 tabular font-semibold', improved ? 'text-success' : 'text-warn')}>
                              {r.delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {r.delta > 0 ? '+' : ''}{round(r.delta, 1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Training days" subtitle="Minutes per day across the month" />
            <div className="p-3">
              <BarsChart data={daily} dataKey="minutes" name="Minutes" unit=" min" labelKey="label" height={190} />
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Records set this month" icon={<Trophy size={16} className="text-warn" />} />
              {monthRecords.length ? (
                <ul className="divide-y divide-line">
                  {monthRecords.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                      <span className="min-w-0 truncate">{getExercise(r.exercise_slug)?.name ?? r.exercise_slug}</span>
                      <span className="font-bold tabular shrink-0">
                        {r.unit === 'kg' ? fmtWeight(r.value, units) : `${r.value} ${r.unit}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 pt-1 text-sm text-ink-3 leading-relaxed">
                  No records this month. Records come in clusters — a month of consistent training usually
                  sets up the next one.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader title="Body metrics" icon={<Scale size={16} />} />
              <div className="px-5 pb-5 pt-1">
                {current.weight !== null ? (
                  <>
                    <p className="text-3xl font-black tabular">
                      {displayWeight(current.weight, units)} <span className="text-base text-ink-3 font-medium">{weightUnit(units)}</span>
                    </p>
                    {previous.weight !== null && (
                      <Badge tone={Math.abs(current.weight - previous.weight) < 0.3 ? 'muted' : 'info'} className="mt-2">
                        {current.weight > previous.weight ? '+' : ''}
                        {round(displayWeight(current.weight, units)! - displayWeight(previous.weight, units)!, 1)} {weightUnit(units)} vs {prevLabel}
                      </Badge>
                    )}
                    <p className="mt-3 text-2xs text-ink-3 leading-relaxed">
                      Bodyweight moves for many reasons other than fat mass — hydration, food volume and
                      glycogen all shift it day to day. The month-to-month trend is the honest signal.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-ink-3 leading-relaxed">
                    No weigh-ins recorded this month. Body measurements are entirely optional — everything
                    else in this report works without them.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" to="/review">Weekly review</Button>
            <Button variant="outline" to="/progress">Full progress</Button>
          </div>
        </>
      )}
    </div>
  );
}
