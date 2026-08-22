import { useMemo, useState } from 'react';
import {
  TrendingUp, Scale, Camera, Plus, Ruler, Dumbbell, HeartPulse, History,
  Trash2, Lock, Trophy, Sparkles, Info,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, SegmentedControl } from '@/components/ui/Tabs';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { ProgressRing } from '@/components/ui/Progress';
import { StatTile } from '@/components/dashboard/StatTile';
import { TrendChart, BarsChart, ScoreRadar, MultiLineChart } from '@/components/charts/Charts';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useFitScore, useFitScoreDelta, useStreak, volumeByDate, completedSessionsSorted } from '@/lib/selectors';
import { FITSCORE_COMPONENTS, fitScoreBand } from '@/lib/fitness/fitscore';
import { buildHistory } from '@/lib/fitness/progression';
import { EXERCISES, getExercise } from '@/data/exercises';
import { SESSION_KIND_META } from '@/lib/fitness/program';
import { displayLength, displayWeight, fmtWeight, inputLengthToCm, inputWeightToKg, lengthUnit, weightUnit } from '@/lib/fitness/units';
import { addDays, formatDate, relativeDay, today, startOfWeek } from '@/lib/date';
import { cn, formatNumber, humanDuration, round } from '@/lib/utils';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import type { BodyMeasurement, ProgressPhoto } from '@/types';

type Tab = 'overview' | 'body' | 'strength' | 'cardio' | 'history' | 'photos';

export default function Progress() {
  const [tab, setTab] = useState<Tab>('overview');
  const sessions = useData((s) => s.sessions);
  const records = useData((s) => s.records);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Progress"
        title="Am I improving?"
        subtitle="Everything here is computed from what you have logged — nothing is estimated where a real number exists."
      />

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'body', label: 'Body' },
          { key: 'strength', label: 'Strength' },
          { key: 'cardio', label: 'Cardio' },
          { key: 'history', label: 'History', count: sessions.filter((s) => s.status === 'completed').length },
          { key: 'photos', label: 'Photos' },
        ]}
      />

      {tab === 'overview' && <Overview />}
      {tab === 'body' && <BodyTab />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'cardio' && <CardioTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'photos' && <PhotosTab />}

      {records.length === 0 && tab === 'overview' && (
        <p className="text-2xs text-ink-3 flex items-start gap-2">
          <Info size={12} className="shrink-0 mt-0.5" />
          Charts fill in as you log sessions. Two data points are enough to draw a trend.
        </p>
      )}
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview() {
  const sessions = useData((s) => s.sessions);
  const sets = useData((s) => s.sets);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const fitScore = useFitScore();
  const delta = useFitScoreDelta();
  const streak = useStreak();

  const volume = useMemo(() => volumeByDate({ sessions, sets }, 90), [sessions, sets]);
  const totalVolume = useMemo(() => volume.reduce((a, v) => a + v.volume, 0), [volume]);
  const completed = sessions.filter((s) => s.status === 'completed');
  const totalMinutes = Math.round(completed.reduce((a, s) => a + s.duration_seconds / 60, 0));

  const weekly = useMemo(() => {
    const out: Array<{ date: string; sessions: number }> = [];
    for (let w = 11; w >= 0; w--) {
      const start = addDays(startOfWeek(today(), 1), -w * 7);
      const end = addDays(start, 6);
      out.push({ date: start, sessions: completed.filter((s) => s.date >= start && s.date <= end).length });
    }
    return out;
  }, [completed]);

  const radar = FITSCORE_COMPONENTS.map((c) => ({
    axis: c.label,
    value: fitScore[c.key as keyof typeof fitScore] as number,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Workouts" value={completed.length} hint="all time" icon={<Dumbbell size={15} />} />
        <StatTile label="Time trained" value={humanDuration(totalMinutes * 60)} icon={<History size={15} />} />
        <StatTile label="Volume (90d)" value={totalVolume > 0 ? fmtWeight(totalVolume, units, 0) : '—'} icon={<TrendingUp size={15} />} />
        <StatTile label="Best streak" value={streak.longest} unit="days" icon={<Sparkles size={15} />} tone="brand" />
      </div>

      <div className="grid lg:grid-cols-[1fr,340px] gap-4">
        <Card>
          <CardHeader title="Training volume" subtitle="Total tonnage per session, last 90 days" />
          <div className="p-3">
            {volume.length >= 2 ? (
              <TrendChart data={volume} dataKey="volume" name="Volume" unit=" kg" height={260} />
            ) : (
              <EmptyState compact icon={<TrendingUp size={20} />} title="Not enough sessions yet"
                body="Log two workouts with weights and your volume trend appears here." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="FitScore" subtitle={fitScoreBand(fitScore.total).note} />
          <div className="p-5 pt-2 text-center">
            <ProgressRing value={fitScore.total} max={1000} size={132} stroke={10} label={`FitScore ${fitScore.total} of 1000`}>
              <span className="text-3xl font-black tabular leading-none">{fitScore.total}</span>
              <span className="text-2xs text-ink-3 mt-1">of 1000</span>
            </ProgressRing>
            {delta !== 0 && (
              <Badge tone={delta > 0 ? 'success' : 'warn'} className="mt-3">
                {delta > 0 ? '+' : ''}{delta} this week
              </Badge>
            )}
          </div>
          <div className="px-3 pb-2">
            <ScoreRadar data={radar} height={210} />
          </div>
          <ul className="px-5 pb-5 space-y-1.5">
            {FITSCORE_COMPONENTS.map((c) => (
              <li key={c.key} className="flex items-center gap-2 text-xs">
                <span className="text-ink-3 flex-1">{c.label}</span>
                <span className="tabular font-semibold w-8 text-right">{fitScore[c.key as keyof typeof fitScore] as number}</span>
                <span className="text-2xs text-ink-3 w-8 text-right">×{c.weight}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5">
            <p className="text-2xs text-ink-3 leading-relaxed">
              FitScore is an engagement and progress indicator, not a clinical health measurement.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Consistency" subtitle="Sessions completed per week, last 12 weeks" />
        <div className="p-3">
          <BarsChart
            data={weekly}
            dataKey="sessions"
            name="Sessions"
            unit=""
            formatLabel={(v) => formatDate(v, 'short')}
            height={200}
          />
        </div>
      </Card>
    </div>
  );
}

/* ---------------- Body ---------------- */

const MEASUREMENT_FIELDS: Array<{ key: keyof BodyMeasurement; label: string }> = [
  { key: 'waist_cm', label: 'Waist' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'arm_cm', label: 'Arm' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'hip_cm', label: 'Hips' },
  { key: 'neck_cm', label: 'Neck' },
];

function BodyTab() {
  const measurements = useData((s) => s.measurements);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const saveMeasurement = useData((s) => s.saveMeasurement);
  const del = useData((s) => s.del);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<'30' | '90' | '365'>('90');

  const sorted = useMemo(() => [...measurements].sort((a, b) => a.date.localeCompare(b.date)), [measurements]);
  const filtered = useMemo(() => {
    const from = addDays(today(), -Number(range));
    return sorted.filter((m) => m.date >= from);
  }, [sorted, range]);

  const weightSeries = filtered
    .filter((m) => m.weight_kg !== null)
    .map((m) => ({ date: m.date, weight: displayWeight(m.weight_kg, units) ?? 0 }));

  const measurementSeries = filtered.map((m) => ({
    date: m.date,
    ...Object.fromEntries(
      MEASUREMENT_FIELDS.map((f) => [f.key, displayLength(m[f.key] as number | null, units)]),
    ),
  }));

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const weightChange =
    latest?.weight_kg && first?.weight_kg && latest !== first
      ? round(latest.weight_kg - first.weight_kg, 1)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[{ value: '30', label: '30 days' }, { value: '90', label: '3 months' }, { value: '365', label: '1 year' }]}
        />
        <Button size="sm" onClick={() => setOpen(true)} icon={<Plus size={14} />}>Log measurement</Button>
      </div>

      {measurements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Scale size={22} />}
            title="No measurements yet"
            body="Weight and circumferences often move at different times. Recording both gives you a fuller picture than either alone."
            action={<Button onClick={() => setOpen(true)} icon={<Plus size={15} />}>Add your first entry</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              label="Current weight"
              value={latest?.weight_kg ? displayWeight(latest.weight_kg, units) : '—'}
              unit={latest?.weight_kg ? weightUnit(units) : undefined}
              trend={weightChange !== null ? -weightChange : undefined}
              hint={weightChange !== null ? 'since first entry' : undefined}
              icon={<Scale size={15} />}
            />
            {MEASUREMENT_FIELDS.slice(0, 3).map((f) => (
              <StatTile
                key={String(f.key)}
                label={f.label}
                value={latest?.[f.key] ? displayLength(latest[f.key] as number, units) : '—'}
                unit={latest?.[f.key] ? lengthUnit(units) : undefined}
                icon={<Ruler size={15} />}
              />
            ))}
          </div>

          <Card>
            <CardHeader title="Weight trend" />
            <div className="p-3">
              {weightSeries.length >= 2 ? (
                <TrendChart data={weightSeries} dataKey="weight" name="Weight" unit={` ${weightUnit(units)}`} color="#7C5CFF" />
              ) : (
                <EmptyState compact title="Log at least two weigh-ins" body="Day-to-day weight swings a lot — the trend is what matters." />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Measurements" subtitle={`All values in ${lengthUnit(units)}`} />
            <div className="p-3">
              {measurementSeries.length >= 2 ? (
                <MultiLineChart
                  data={measurementSeries}
                  series={MEASUREMENT_FIELDS.map((f) => ({ key: String(f.key), name: f.label }))}
                  unit={` ${lengthUnit(units)}`}
                />
              ) : (
                <EmptyState compact title="Not enough entries" body="Two or more measurement dates will draw a trend." />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="All entries" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="text-2xs uppercase tracking-wider text-ink-3">
                  <tr className="border-b border-line">
                    <th scope="col" className="text-left font-semibold px-5 py-2.5">Date</th>
                    <th scope="col" className="text-right font-semibold px-3 py-2.5">Weight</th>
                    {MEASUREMENT_FIELDS.map((f) => (
                      <th key={String(f.key)} scope="col" className="text-right font-semibold px-3 py-2.5">{f.label}</th>
                    ))}
                    <th scope="col" className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...sorted].reverse().map((m) => (
                    <tr key={m.id} className="hover:bg-surface-2">
                      <td className="px-5 py-2.5">
                        <span className="font-medium">{formatDate(m.date, 'medium')}</span>
                        {m.note && <span className="block text-2xs text-ink-3">{m.note}</span>}
                      </td>
                      <td className="text-right px-3 tabular">{m.weight_kg ? displayWeight(m.weight_kg, units) : '—'}</td>
                      {MEASUREMENT_FIELDS.map((f) => (
                        <td key={String(f.key)} className="text-right px-3 tabular">
                          {m[f.key] ? displayLength(m[f.key] as number, units) : '—'}
                        </td>
                      ))}
                      <td className="px-3">
                        <button
                          type="button"
                          onClick={() => void del('body_measurements', m.id)}
                          aria-label={`Delete entry from ${formatDate(m.date, 'medium')}`}
                          className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {open && (
        <MeasurementModal
          onClose={() => setOpen(false)}
          onSave={async (m) => { await saveMeasurement(m); setOpen(false); toast.success('Measurement saved'); }}
        />
      )}
    </div>
  );
}

function MeasurementModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (m: Omit<BodyMeasurement, 'id' | 'user_id'>) => void | Promise<void>;
}) {
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const num = (k: string) => (values[k] && Number.isFinite(Number(values[k])) ? Number(values[k]) : null);

  return (
    <Modal
      open onClose={onClose} title="Log a measurement"
      description="Fill in only what you want to track. Blank fields are simply not recorded."
      footer={
        <Button
          block
          onClick={() => void onSave({
            date,
            weight_kg: num('weight') !== null ? inputWeightToKg(num('weight')!, units) : null,
            body_fat_pct: num('bf'),
            waist_cm: num('waist') !== null ? inputLengthToCm(num('waist')!, units) : null,
            chest_cm: num('chest') !== null ? inputLengthToCm(num('chest')!, units) : null,
            arm_cm: num('arm') !== null ? inputLengthToCm(num('arm')!, units) : null,
            thigh_cm: num('thigh') !== null ? inputLengthToCm(num('thigh')!, units) : null,
            hip_cm: num('hip') !== null ? inputLengthToCm(num('hip')!, units) : null,
            neck_cm: num('neck') !== null ? inputLengthToCm(num('neck')!, units) : null,
            note,
          })}
        >
          Save entry
        </Button>
      }
    >
      <div className="space-y-3">
        <Input label="Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={`Weight (${weightUnit(units)})`} type="number" inputMode="decimal" step="0.1"
            value={values.weight ?? ''} onChange={(e) => setValues({ ...values, weight: e.target.value })} />
          <Input label="Body fat (%)" type="number" inputMode="decimal" step="0.1"
            value={values.bf ?? ''} onChange={(e) => setValues({ ...values, bf: e.target.value })} />
          {[['waist', 'Waist'], ['chest', 'Chest'], ['arm', 'Upper arm'], ['thigh', 'Thigh'], ['hip', 'Hips'], ['neck', 'Neck']].map(([k, label]) => (
            <Input
              key={k} label={`${label} (${lengthUnit(units)})`} type="number" inputMode="decimal" step="0.1"
              value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })}
            />
          ))}
        </div>
        <Textarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>
    </Modal>
  );
}

/* ---------------- Strength ---------------- */

function StrengthTab() {
  const sets = useData((s) => s.sets);
  const sessions = useData((s) => s.sessions);
  const records = useData((s) => s.records);
  const units = useData((s) => s.preferences?.units ?? 'metric');

  const tracked = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) {
      if (!s.completed || s.is_warmup || s.weight_kg === null) continue;
      counts.set(s.exercise_slug, (counts.get(s.exercise_slug) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  }, [sets]);

  const [slug, setSlug] = useState<string>(tracked[0] ?? 'barbell-bench-press');
  const activeSlug = tracked.includes(slug) ? slug : tracked[0] ?? slug;

  const history = useMemo(() => {
    const dates = new Map(sessions.map((x) => [x.id, x.date]));
    return buildHistory(sets.filter((s) => s.exercise_slug === activeSlug), (id) => dates.get(id) ?? null);
  }, [sets, sessions, activeSlug]);

  const chart = useMemo(
    () =>
      [...history].reverse().map((h) => ({
        date: h.date,
        e1rm: h.best1RM !== null ? displayWeight(h.best1RM, units) ?? 0 : 0,
        top: h.topWeight !== null ? displayWeight(h.topWeight, units) ?? 0 : 0,
      })),
    [history, units],
  );

  if (tracked.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Dumbbell size={22} />}
          title="No strength data yet"
          body="Log a workout with weights and this page will chart your estimated one-rep max over time."
          action={<Button to="/workout" icon={<Dumbbell size={15} />}>Start a workout</Button>}
        />
      </Card>
    );
  }

  const exercise = getExercise(activeSlug);
  const best = records.filter((r) => r.exercise_slug === activeSlug).sort((a, b) => b.value - a.value)[0];

  return (
    <div className="space-y-4">
      <Select
        label="Exercise"
        value={activeSlug}
        onChange={(e) => setSlug(e.target.value)}
        options={tracked.map((s) => ({ value: s, label: EXERCISES.find((x) => x.slug === s)?.name ?? s }))}
        className="max-w-sm"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Sessions logged" value={history.length} icon={<History size={15} />} />
        <StatTile
          label="Best estimated 1RM"
          value={history.reduce((a, h) => Math.max(a, h.best1RM ?? 0), 0) > 0
            ? fmtWeight(history.reduce((a, h) => Math.max(a, h.best1RM ?? 0), 0), units)
            : '—'}
          icon={<TrendingUp size={15} />} tone="brand"
        />
        <StatTile label="Heaviest set" value={best ? fmtWeight(best.weight_kg ?? best.value, units) : '—'} icon={<Trophy size={15} />} />
        <StatTile
          label="Total volume"
          value={fmtWeight(history.reduce((a, h) => a + h.volume, 0), units, 0)}
          icon={<Dumbbell size={15} />}
        />
      </div>

      <Card>
        <CardHeader
          title={exercise?.name ?? activeSlug}
          subtitle="Estimated 1RM and heaviest working set per session"
        />
        <div className="p-3">
          {chart.length >= 2 ? (
            <MultiLineChart
              data={chart}
              series={[
                { key: 'e1rm', name: 'Estimated 1RM', color: '#B9F227' },
                { key: 'top', name: 'Top set', color: '#7C5CFF' },
              ]}
              unit={` ${weightUnit(units)}`}
              height={280}
            />
          ) : (
            <EmptyState compact title="One session logged" body="Log this exercise again to see the trend." />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Session detail" />
        <ul className="divide-y divide-line">
          {history.slice(0, 12).map((h) => (
            <li key={h.session_id} className="px-5 py-3 flex items-center gap-4">
              <div className="w-24 shrink-0">
                <p className="text-sm font-medium">{relativeDay(h.date)}</p>
                <p className="text-2xs text-ink-3">{formatDate(h.date, 'short')}</p>
              </div>
              <p className="flex-1 text-sm tabular text-ink-2">
                {h.sets.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && <span className="text-ink-3"> · </span>}
                    {s.weight_kg !== null ? `${displayWeight(s.weight_kg, units)}×${s.reps}` : `${s.reps ?? s.seconds}`}
                  </span>
                ))}
              </p>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular">{fmtWeight(h.volume, units, 0)}</p>
                <p className="text-2xs text-ink-3">volume</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------------- Cardio ---------------- */

function CardioTab() {
  const sets = useData((s) => s.sets);
  const sessions = useData((s) => s.sessions);
  const units = useData((s) => s.preferences?.units ?? 'metric');

  const cardioSets = useMemo(() => {
    const dates = new Map(sessions.map((x) => [x.id, x.date]));
    return sets
      .filter((s) => s.completed && ((s.distance_km ?? 0) > 0 || (s.seconds ?? 0) > 0) && getExercise(s.exercise_slug)?.type === 'cardio')
      .map((s) => ({ ...s, date: dates.get(s.session_id) ?? '' }))
      .filter((s) => s.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sets, sessions]);

  const distanceSeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of cardioSets) byDate.set(s.date, (byDate.get(s.date) ?? 0) + (s.distance_km ?? 0));
    return [...byDate.entries()].map(([date, km]) => ({ date, distance: round(km, 2) }));
  }, [cardioSets]);

  const minutesSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.status !== 'completed' || (s.kind !== 'cardio' && s.kind !== 'recovery')) continue;
      map.set(s.date, (map.get(s.date) ?? 0) + Math.round(s.duration_seconds / 60));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, minutes]) => ({ date, minutes }));
  }, [sessions]);

  const totalDistance = cardioSets.reduce((a, s) => a + (s.distance_km ?? 0), 0);
  const totalMinutes = sessions
    .filter((s) => s.status === 'completed' && (s.kind === 'cardio' || s.kind === 'recovery'))
    .reduce((a, s) => a + s.duration_seconds / 60, 0);

  if (cardioSets.length === 0 && minutesSeries.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<HeartPulse size={22} />}
          title="No cardio logged yet"
          body="Walks, runs, rides and rows all count. Log one and your distance and duration trends will appear here."
          action={<Button to="/workout" icon={<HeartPulse size={15} />}>Log a cardio session</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total distance" value={round(units === 'metric' ? totalDistance : totalDistance / 1.609344, 1)} unit={units === 'metric' ? 'km' : 'mi'} icon={<HeartPulse size={15} />} tone="brand" />
        <StatTile label="Cardio minutes" value={Math.round(totalMinutes)} unit="min" icon={<History size={15} />} />
        <StatTile label="Sessions" value={sessions.filter((s) => s.status === 'completed' && (s.kind === 'cardio' || s.kind === 'recovery')).length} icon={<Dumbbell size={15} />} />
        <StatTile
          label="Longest single"
          value={cardioSets.length ? round(Math.max(...cardioSets.map((s) => s.distance_km ?? 0)), 2) : '—'}
          unit={cardioSets.length ? 'km' : undefined}
          icon={<Trophy size={15} />}
        />
      </div>

      <Card>
        <CardHeader title="Distance covered" subtitle="Per day" />
        <div className="p-3">
          {distanceSeries.length >= 2 ? (
            <TrendChart data={distanceSeries} dataKey="distance" name="Distance" unit=" km" color="#38BDF8" />
          ) : (
            <EmptyState compact title="Log distance on your cardio sets" body="Enter distance while logging a run, ride or walk." />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Cardio minutes" subtitle="Per day" />
        <div className="p-3">
          {minutesSeries.length >= 1 ? (
            <BarsChart data={minutesSeries} dataKey="minutes" name="Minutes" unit=" min" formatLabel={(v) => formatDate(v, 'short')} />
          ) : (
            <EmptyState compact title="No cardio sessions yet" />
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- History ---------------- */

function HistoryTab() {
  const sessions = useData((s) => s.sessions);
  const sets = useData((s) => s.sets);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const completed = useMemo(() => completedSessionsSorted(sessions), [sessions]);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (completed.length === 0) {
    return (
      <Card>
        <EmptyState icon={<History size={22} />} title="No workout history yet"
          body="Completed sessions appear here with duration, sets, volume and your notes." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Workout history" subtitle={`${completed.length} completed sessions`} />
      <ul className="divide-y divide-line">
        {completed.slice(0, 60).map((s) => {
          const sessionSets = sets.filter((x) => x.session_id === s.id && x.completed && !x.is_warmup);
          const volume = sessionSets.reduce((a, x) => a + (x.weight_kg ?? 0) * (x.reps ?? 0), 0);
          const open = expanded === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : s.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2 transition-colors"
              >
                <span className="h-10 w-10 rounded-xl bg-surface-2 grid place-items-center text-ink-2 shrink-0">
                  <Icon name={SESSION_KIND_META[s.kind].icon} size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{s.title}</p>
                  <p className="text-2xs text-ink-3 tabular">
                    {formatDate(s.date, 'medium')} · {humanDuration(s.duration_seconds)} · {sessionSets.length} sets
                    {volume > 0 && ` · ${fmtWeight(volume, units, 0)}`}
                  </p>
                </div>
                {s.difficulty && <Badge size="sm" tone="muted">RPE {s.difficulty}/5</Badge>}
                {s.feeling && <Badge size="sm" tone="muted" className="hidden sm:inline-flex">{s.feeling}</Badge>}
              </button>

              {open && (
                <div className="px-5 pb-4 animate-fade-in">
                  {s.notes && (
                    <p className="mb-3 p-3 rounded-xl bg-surface-2 border border-line text-sm text-ink-2 leading-relaxed">
                      {s.notes}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {[...new Set(sessionSets.map((x) => x.exercise_slug))].map((slug) => {
                      const rows = sessionSets.filter((x) => x.exercise_slug === slug);
                      return (
                        <li key={slug} className="flex items-start gap-3 text-sm">
                          <span className="min-w-0 flex-1 truncate font-medium">{getExercise(slug)?.name ?? slug}</span>
                          <span className="text-2xs text-ink-3 tabular text-right">
                            {rows.map((r, i) => (
                              <span key={r.id}>
                                {i > 0 && ' · '}
                                {r.weight_kg !== null ? `${displayWeight(r.weight_kg, units)}×${r.reps}` : r.seconds ? `${r.seconds}s` : `${r.reps} reps`}
                              </span>
                            ))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {s.est_calories !== null && (
                    <p className="mt-3 text-2xs text-ink-3">≈ {formatNumber(s.est_calories)} kcal (estimated)</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- Photos ---------------- */

function PhotosTab() {
  const photos = useData((s) => s.photos);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);
  const userId = useData((s) => s.userId);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ProgressPhoto | null>(null);

  const sorted = [...photos].sort((a, b) => b.date.localeCompare(a.date));

  const onFile = async (file: File, pose: ProgressPhoto['pose'], date: string) => {
    if (!userId) return;
    if (file.size > 4_000_000) { toast.error('Image too large', 'Please choose a photo under 4 MB.'); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await put('progress_photos', {
      id: uid('photo'), user_id: userId, date, pose, data_url: dataUrl, note: '', private: true,
    });
    setAdding(false);
    toast.success('Photo saved', 'Stored privately and never shared automatically.');
  };

  return (
    <div className="space-y-4">
      <Card className="border-accent/30">
        <div className="p-4 flex items-start gap-3">
          <Lock size={17} className="shrink-0 mt-0.5 text-accent-text" />
          <div>
            <p className="text-sm font-semibold">Progress photos are private</p>
            <p className="text-xs text-ink-3 mt-1 leading-relaxed">
              They are stored only in your own account and are never included in sharing, leaderboards or
              trainer views unless you explicitly send them. Delete any of them at any time.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)} icon={<Camera size={14} />}>Add photo</Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Camera size={22} />}
            title="No progress photos"
            body="Photos taken in the same spot, light and pose show change the scale often hides. Entirely optional."
            action={<Button onClick={() => setAdding(true)} icon={<Camera size={15} />}>Add your first photo</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map((p) => (
            <Card key={p.id} className="group relative">
              <img src={p.data_url} alt={`Progress photo, ${p.pose} view, ${formatDate(p.date, 'medium')}`}
                className="w-full aspect-[3/4] object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-xs font-medium capitalize">{p.pose}</p>
                <p className="text-2xs text-ink-3">{formatDate(p.date, 'medium')}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(p)}
                aria-label="Delete photo"
                className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-lg bg-bg/80 backdrop-blur text-ink-2 hover:text-danger opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))}
        </div>
      )}

      {adding && <PhotoModal onClose={() => setAdding(false)} onFile={onFile} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await del('progress_photos', deleting.id); setDeleting(null); toast.info('Photo deleted'); }}
        title="Delete this photo?"
        body="It will be removed permanently from your account."
        confirmLabel="Delete"
      />
    </div>
  );
}

function PhotoModal({ onClose, onFile }: {
  onClose: () => void;
  onFile: (file: File, pose: ProgressPhoto['pose'], date: string) => void | Promise<void>;
}) {
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [date, setDate] = useState(today());
  const [file, setFile] = useState<File | null>(null);

  return (
    <Modal
      open onClose={onClose} title="Add a progress photo"
      description="Stored privately in your account only."
      footer={
        <Button block disabled={!file} onClick={() => file && void onFile(file, pose, date)}>Save photo</Button>
      }
    >
      <div className="space-y-3">
        <Select
          label="Pose" value={pose}
          onChange={(e) => setPose(e.target.value as ProgressPhoto['pose'])}
          options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]}
        />
        <Input label="Date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        <div>
          <label htmlFor="photo-file" className="block text-sm font-medium text-ink-2 mb-1.5">Photo</label>
          <input
            id="photo-file"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={cn(
              'w-full text-sm text-ink-2 file:mr-3 file:h-10 file:px-4 file:rounded-xl file:border-0',
              'file:bg-surface-2 file:text-ink file:font-semibold file:cursor-pointer',
            )}
          />
          <p className="mt-1.5 text-2xs text-ink-3">Maximum 4 MB. Same spot, same light and same pose makes comparison meaningful.</p>
        </div>
      </div>
    </Modal>
  );
}
