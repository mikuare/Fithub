import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Search, TrendingUp, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useData } from '@/store/data';
import { getExercise } from '@/data/exercises';
import { RECORD_KIND_LABEL, lowerIsBetter } from '@/lib/fitness/records';
import { fmtWeight } from '@/lib/fitness/units';
import { formatPace } from '@/lib/fitness/calculations';
import { formatDate, relativeDay } from '@/lib/date';
import { formatDuration, matches, round } from '@/lib/utils';
import type { PersonalRecord } from '@/types';

export default function Records() {
  const records = useData((s) => s.records);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'best' | 'timeline'>('best');

  const formatValue = (r: PersonalRecord) => {
    if (r.kind === 'best_pace') return formatPace(r.value);
    if (r.kind === 'max_duration') return formatDuration(r.value);
    if (r.unit === 'kg') return fmtWeight(r.value, units);
    if (r.unit === 'km') return `${round(r.value, 2)} km`;
    return `${r.value} ${r.unit}`;
  };

  /** Only the current best per exercise + kind. */
  const bests = useMemo(() => {
    const map = new Map<string, PersonalRecord>();
    for (const r of records) {
      const key = `${r.exercise_slug}:${r.kind}`;
      const existing = map.get(key);
      if (!existing || (lowerIsBetter(r.kind) ? r.value < existing.value : r.value > existing.value)) {
        map.set(key, r);
      }
    }
    return [...map.values()];
  }, [records]);

  const filtered = useMemo(() => {
    const list = tab === 'best' ? bests : records;
    return list
      .filter((r) => {
        if (!query.trim()) return true;
        const name = getExercise(r.exercise_slug)?.name ?? r.exercise_slug;
        return matches(name, query) || matches(RECORD_KIND_LABEL[r.kind], query);
      })
      .sort((a, b) =>
        tab === 'best'
          ? (getExercise(a.exercise_slug)?.name ?? '').localeCompare(getExercise(b.exercise_slug)?.name ?? '')
          : b.achieved_at.localeCompare(a.achieved_at),
      );
  }, [bests, records, query, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, PersonalRecord[]>();
    for (const r of filtered) {
      const list = map.get(r.exercise_slug) ?? [];
      list.push(r);
      map.set(r.exercise_slug, list);
    }
    return [...map.entries()];
  }, [filtered]);

  if (records.length === 0) {
    return (
      <div className="max-w-3xl">
        <PageHeader eyebrow="Personal Records" title="Your bests" />
        <Card>
          <EmptyState
            icon={<Trophy size={22} />}
            title="No records yet"
            body="Records are detected automatically from your logged sets — heaviest lift, estimated 1RM, most reps, longest hold, furthest distance and fastest pace."
            action={<Button to="/workout">Log a workout</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        eyebrow="Personal Records"
        title={`${bests.length} current bests`}
        subtitle="Detected automatically as you log. Warm-up sets never count toward a record."
      />

      <div className="flex flex-wrap gap-2">
        <Tabs
          value={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={[
            { key: 'best', label: 'Current bests', count: bests.length },
            { key: 'timeline', label: 'All records', count: records.length },
          ]}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search records…"
          prefix={<Search size={15} />}
          aria-label="Search records"
          className="flex-1 min-w-[200px]"
        />
      </div>

      {tab === 'best' ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {grouped.map(([slug, list]) => {
            const exercise = getExercise(slug);
            return (
              <Card key={slug}>
                <CardHeader
                  title={
                    <Link to={`/exercises/${slug}`} className="hover:text-brand-text transition-colors">
                      {exercise?.name ?? slug}
                    </Link>
                  }
                  subtitle={exercise?.primary.join(' · ').replace(/_/g, ' ')}
                  icon={<span className="text-lg" aria-hidden>🏆</span>}
                  dense
                />
                <ul className="px-4 pb-4 pt-2 space-y-2">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-ink-3">{RECORD_KIND_LABEL[r.kind]}</span>
                      <span className="text-right">
                        <span className="block text-lg font-black tabular leading-tight">{formatValue(r)}</span>
                        <span className="block text-2xs text-ink-3">
                          {r.reps ? `${r.reps} reps · ` : ''}{relativeDay(r.achieved_at.slice(0, 10))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {filtered.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="text-xl shrink-0" aria-hidden>🏆</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/exercises/${r.exercise_slug}`} className="font-semibold text-sm hover:text-brand-text transition-colors">
                    {getExercise(r.exercise_slug)?.name ?? r.exercise_slug}
                  </Link>
                  <p className="text-2xs text-ink-3">
                    {RECORD_KIND_LABEL[r.kind]} · {formatDate(r.achieved_at.slice(0, 10), 'medium')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black tabular">{formatValue(r)}</p>
                  {r.previous_value !== null && (
                    <p className="text-2xs text-success tabular inline-flex items-center gap-1">
                      <TrendingUp size={10} />
                      from {lowerIsBetter(r.kind) ? formatPace(r.previous_value) : round(r.previous_value, 1)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card>
          <EmptyState compact icon={<Search size={20} />} title="No matching records"
            body={`Nothing matches "${query}".`} />
        </Card>
      )}

      <Card>
        <div className="p-4 flex items-start gap-2.5">
          <Calendar size={15} className="shrink-0 mt-0.5 text-ink-3" />
          <p className="text-2xs text-ink-3 leading-relaxed">
            Estimated one-rep maxima are calculated from your logged weight and reps using a blend of the
            Epley and Brzycki formulas. They are estimates and become less reliable above about 12 reps —
            FitHub caps the input to keep them sensible.
          </p>
        </div>
      </Card>
    </div>
  );
}
