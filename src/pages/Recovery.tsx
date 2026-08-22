import { useMemo, useState } from 'react';
import { BatteryCharging, Moon, Zap, Activity, Brain, Save, Info, AlertTriangle, Smile } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/Progress';
import { Input, ScaleInput, Textarea, Label } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { TrendChart, MultiLineChart } from '@/components/charts/Charts';
import { useData } from '@/store/data';
import { computeRecoveryScore } from '@/lib/fitness/recovery';
import { RED_FLAG_MESSAGE } from '@/lib/defaults';
import { addDays, formatDate, relativeDay, today } from '@/lib/date';
import { cn, round } from '@/lib/utils';
import { toast } from '@/store/toast';

export default function Recovery() {
  const recovery = useData((s) => s.recovery);
  const sessions = useData((s) => s.sessions);
  const saveRecovery = useData((s) => s.saveRecovery);

  const existing = recovery.find((r) => r.date === today());
  const [sleep, setSleep] = useState(existing?.sleep_hours !== null && existing?.sleep_hours !== undefined ? String(existing.sleep_hours) : '');
  const [sleepQuality, setSleepQuality] = useState<number | null>(existing?.sleep_quality ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [soreness, setSoreness] = useState<number | null>(existing?.soreness ?? null);
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const draft = {
    sleep_hours: sleep ? Number(sleep) : null,
    sleep_quality: sleepQuality,
    energy, soreness, stress,
  };
  const readout = useMemo(() => computeRecoveryScore(draft, sessions), [sleep, sleepQuality, energy, soreness, stress, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useMemo(() => {
    const from = addDays(today(), -60);
    return recovery
      .filter((r) => r.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ date: r.date, score: r.score, sleep: r.sleep_hours, energy: r.energy ? r.energy * 20 : null }));
  }, [recovery]);

  const avgSleep7 = useMemo(() => {
    const from = addDays(today(), -6);
    const week = recovery.filter((r) => r.date >= from && typeof r.sleep_hours === 'number');
    if (!week.length) return null;
    return round(week.reduce((a, r) => a + (r.sleep_hours ?? 0), 0) / week.length, 1);
  }, [recovery]);

  const save = async () => {
    setSaving(true);
    try {
      await saveRecovery({
        date: today(),
        sleep_hours: draft.sleep_hours,
        sleep_quality: sleepQuality,
        energy, soreness, stress, mood, note,
      });
      toast.success('Recovery logged', `Readiness ${readout.score}/100 — ${readout.label}.`);
    } finally {
      setSaving(false);
    }
  };

  const hasAny = readout.hasInput;

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Recovery"
        title="How ready are you today?"
        subtitle="A 20-second check-in. This is a self-awareness signal, not a medical measurement — and sometimes the right answer is rest."
      />

      <div className="grid lg:grid-cols-[1fr,320px] gap-4">
        {/* Check-in */}
        <Card>
          <CardHeader title="Daily check-in" subtitle={relativeDay(today())} />
          <div className="p-5 pt-3 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Sleep last night (hours)"
                type="number" inputMode="decimal" step="0.25" min={0} max={16}
                value={sleep} onChange={(e) => setSleep(e.target.value)}
                placeholder="7.5" inputSize="lg"
                prefix={<Moon size={14} />}
              />
              <div>
                <Label>Sleep quality</Label>
                <ScaleInput name="Sleep quality" value={sleepQuality} onChange={setSleepQuality} labels={['Broken', 'Restful']} />
              </div>
            </div>

            <div>
              <Label hint="How much have you got in the tank right now?">Energy</Label>
              <ScaleInput name="Energy" value={energy} onChange={setEnergy} labels={['Drained', 'Full of it']} />
            </div>

            <div>
              <Label hint="5 means very sore.">Muscle soreness</Label>
              <ScaleInput name="Soreness" value={soreness} onChange={setSoreness} labels={['None', 'Very sore']} />
            </div>

            <div>
              <Label hint="Life stress competes with training for recovery.">Stress</Label>
              <ScaleInput name="Stress" value={stress} onChange={setStress} labels={['Calm', 'Very stressed']} />
            </div>

            <div>
              <Label>Mood</Label>
              <ScaleInput name="Mood" value={mood} onChange={setMood} labels={['Low', 'Great']} />
            </div>

            <Textarea
              label="Anything worth noting?"
              hint="Optional — travel, illness, a heavy week at work."
              value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            />

            <Button size="lg" block onClick={() => void save()} loading={saving} disabled={!hasAny} icon={<Save size={17} />}>
              {existing ? 'Update today’s check-in' : 'Save check-in'}
            </Button>
          </div>
        </Card>

        {/* Readout */}
        <aside className="space-y-3">
          <Card className={cn(
            hasAny && readout.score < 45 && 'border-warn/40',
            hasAny && readout.score >= 72 && 'border-brand/40',
          )}>
            <div className="p-5 text-center">
              <ProgressRing
                value={hasAny ? readout.score : 0}
                size={148} stroke={11}
                tone={readout.score >= 72 ? 'brand' : readout.score >= 55 ? 'info' : readout.score >= 38 ? 'warn' : 'danger'}
                label={hasAny ? `Recovery score ${readout.score} of 100` : 'No check-in yet'}
              >
                <span className="text-4xl font-black tabular leading-none">{hasAny ? readout.score : '—'}</span>
                <span className="text-2xs text-ink-3 mt-1">/ 100</span>
              </ProgressRing>
              <p className="mt-4 font-bold text-lg">{readout.label}</p>
              <p className="mt-0.5 text-sm text-ink-2">{readout.headline}</p>
              <p className="mt-3 text-sm text-ink-3 leading-relaxed">{readout.advice}</p>
            </div>
          </Card>

          {hasAny && readout.contributions.length > 0 && (
            <Card>
              <CardHeader title="What's driving it" dense />
              <ul className="p-4 pt-2 space-y-3">
                {readout.contributions.map((c) => (
                  <li key={c.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-ink-2">{c.label}</span>
                      <span className="tabular text-ink-3">{Math.round(c.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', c.value >= 70 ? 'bg-success' : c.value >= 45 ? 'bg-warn' : 'bg-danger')}
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                    <p className="mt-1 text-2xs text-ink-3 leading-relaxed">{c.note}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="border-danger/25">
            <div className="p-4">
              <p className="flex items-start gap-2 text-xs text-ink-2 leading-relaxed">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-danger" />
                <span>{RED_FLAG_MESSAGE}</span>
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {/* History */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Recovery trend"
            subtitle="Last 60 days"
            action={avgSleep7 !== null ? <Badge tone="muted">7-day sleep avg {avgSleep7}h</Badge> : undefined}
          />
          <div className="p-3">
            {history.length >= 2 ? (
              <TrendChart data={history} dataKey="score" name="Recovery" unit="/100" domain={[0, 100]} />
            ) : (
              <EmptyState compact icon={<BatteryCharging size={20} />} title="Not enough check-ins yet"
                body="Log two or more days and your trend appears here." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Sleep and energy" subtitle="Energy scaled to 100 for comparison" />
          <div className="p-3">
            {history.filter((h) => h.sleep !== null).length >= 2 ? (
              <MultiLineChart
                data={history}
                series={[
                  { key: 'sleep', name: 'Sleep (h)', color: '#7C5CFF' },
                  { key: 'energy', name: 'Energy', color: '#B9F227' },
                ]}
              />
            ) : (
              <EmptyState compact icon={<Moon size={20} />} title="No sleep data yet"
                body="Sleep is the single biggest lever on how you feel and perform." />
            )}
          </div>
        </Card>
      </div>

      {/* Recent entries */}
      {recovery.length > 0 && (
        <Card>
          <CardHeader title="Recent check-ins" />
          <ul className="divide-y divide-line">
            {[...recovery].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-medium">{relativeDay(r.date)}</p>
                  <p className="text-2xs text-ink-3">{formatDate(r.date, 'short')}</p>
                </div>
                <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-ink-3">
                  {r.sleep_hours !== null && <span className="inline-flex items-center gap-1"><Moon size={11} />{r.sleep_hours}h</span>}
                  {r.energy !== null && <span className="inline-flex items-center gap-1"><Zap size={11} />{r.energy}/5</span>}
                  {r.soreness !== null && <span className="inline-flex items-center gap-1"><Activity size={11} />{r.soreness}/5</span>}
                  {r.stress !== null && <span className="inline-flex items-center gap-1"><Brain size={11} />{r.stress}/5</span>}
                  {r.mood !== null && <span className="inline-flex items-center gap-1"><Smile size={11} />{r.mood}/5</span>}
                </div>
                <span className={cn(
                  'shrink-0 tabular font-black text-lg',
                  r.score >= 72 ? 'text-success' : r.score >= 45 ? 'text-warn' : 'text-danger',
                )}>
                  {r.score}
                </span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-3 border-t border-line">
            <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>
                Missing inputs are excluded from the score rather than treated as neutral, so a partial
                check-in still gives you an honest number.
              </span>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
