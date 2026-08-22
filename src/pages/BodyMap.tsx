import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bandage, CheckCheck, Info, PersonStanding, Plus,
  Scale, Sparkles, Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { PaywallGate } from '@/components/PaywallGate';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { MuscleMap, MuscleHeatLegend } from '@/components/MuscleMap';
import { useData } from '@/store/data';
import { useTodaysProgramDay } from '@/lib/selectors';
import {
  activeNiggles, computeMuscleFreshness, freshnessByMuscle, sessionCautions,
  weeklyBalance, FRESHNESS_STATUS_META, SEVERITY_HELP, SEVERITY_LABEL, TRACKED_MUSCLES,
  type FreshnessStatus,
} from '@/lib/fitness/freshness';
import { EXERCISES, MUSCLE_LABEL, getExercise } from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { diffDays, formatDate, relativeDay, today } from '@/lib/date';
import { uid } from '@/lib/id';
import { cn, pluralize } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { MuscleGroup, Niggle, NiggleSeverity, NiggleSide } from '@/types';

const STATUS_TONE: Record<FreshnessStatus, 'success' | 'warn' | 'danger'> = {
  fresh: 'success', recovering: 'warn', fatigued: 'danger',
};

export default function BodyMapPage() {
  return (
    <PaywallGate
      feature="body_map"
      title="Body Map"
      blurb="A living heat map of your body. Every set you log feeds fatigue into the muscles it works, that fatigue decays at muscle-realistic rates, and the map shows what is fresh, recovering or fatigued right now."
      bullets={[
        'Muscle-by-muscle freshness computed from your own sets',
        'Niggle journal — log aches, and exercises that stress them get flagged',
        'Suggested swaps that respect your equipment',
        'Weekly push/pull and quad/posterior-chain balance',
      ]}
    >
      <BodyMap />
    </PaywallGate>
  );
}

function BodyMap() {
  const sets = useData((s) => s.sets);
  const sessions = useData((s) => s.sessions);
  const niggles = useData((s) => s.niggles);
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const userId = useData((s) => s.userId);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);
  const programDay = useTodaysProgramDay();

  const freshness = useMemo(() => computeMuscleFreshness(sets, sessions), [sets, sessions]);
  const byMuscle = useMemo(() => freshnessByMuscle(freshness), [freshness]);
  const active = useMemo(() => activeNiggles(niggles), [niggles]);
  const resolved = useMemo(
    () => niggles.filter((n) => n.resolved_date).sort((a, b) => (b.resolved_date ?? '').localeCompare(a.resolved_date ?? '')),
    [niggles],
  );
  const balance = useMemo(() => weeklyBalance(sets, sessions), [sets, sessions]);
  const cautions = useMemo(
    () => sessionCautions(programDay?.exercises ?? [], freshness, niggles, fitnessProfile?.equipment),
    [programDay, freshness, niggles, fitnessProfile],
  );

  const sorted = useMemo(() => [...freshness].sort((a, b) => a.freshness - b.freshness), [freshness]);
  const hasTraining = freshness.some((f) => f.lastTrained !== null);

  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const detail = selected ? byMuscle.get(selected) ?? null : null;
  const heat = useMemo(
    () => Object.fromEntries(freshness.map((f) => [f.muscle, f.freshness])) as Partial<Record<MuscleGroup, number>>,
    [freshness],
  );

  /* ---- niggle form ---- */
  const [formOpen, setFormOpen] = useState(false);
  const [formMuscle, setFormMuscle] = useState<MuscleGroup>('shoulders');
  const [formSide, setFormSide] = useState<NiggleSide>('both');
  const [formSeverity, setFormSeverity] = useState<NiggleSeverity>(1);
  const [formDate, setFormDate] = useState(today());
  const [formNote, setFormNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Niggle | null>(null);

  const openForm = (muscle?: MuscleGroup) => {
    if (muscle) setFormMuscle(muscle);
    setFormSide('both');
    setFormSeverity(1);
    setFormDate(today());
    setFormNote('');
    setFormOpen(true);
  };

  const saveNiggle = async () => {
    if (!userId) return;
    const row: Niggle = {
      id: uid('ngl'), user_id: userId,
      muscle: formMuscle, side: formSide, severity: formSeverity,
      note: formNote.trim(),
      started_date: formDate || today(),
      resolved_date: null,
      created_at: new Date().toISOString(),
    };
    await put('niggles', row);
    setFormOpen(false);
    toast.success('Niggle logged', `${MUSCLE_LABEL[formMuscle]} — exercises that stress it are now flagged.`);
  };

  const resolveNiggle = async (n: Niggle) => {
    await put('niggles', { ...n, resolved_date: today() });
    toast.brand('Marked resolved', `Good news for your ${MUSCLE_LABEL[n.muscle].toLowerCase()}.`);
  };

  const exercisesFor = (muscle: MuscleGroup) =>
    EXERCISES
      .filter((e) => e.primary.includes(muscle))
      .filter((e) => !fitnessProfile || canPerform(e, fitnessProfile.equipment))
      .slice(0, 4);

  const hasSeverePain = active.some((n) => n.severity >= 3);

  return (
    <div className="space-y-5 max-w-6xl">
      <PageHeader
        eyebrow="Body Map"
        title="Your body right now"
        subtitle="Muscle-by-muscle freshness estimated from the sets you have logged, plus a journal for aches so training steers around them. An estimate from training data — not a medical measurement."
        actions={<Button onClick={() => openForm()} icon={<Plus size={15} />}>Log a niggle</Button>}
      />

      <div className="grid lg:grid-cols-[340px,1fr] gap-4 items-start">
        {/* Heat map */}
        <Card>
          <CardHeader title="Freshness heat map" subtitle="Tap a muscle for detail" dense />
          <div className="p-4 pt-1">
            <MuscleMap
              view="both" size={118} showLabels
              heat={heat}
              markers={active.map((n) => n.muscle)}
              selectedMuscle={selected}
              onSelectMuscle={(m) => setSelected((cur) => (cur === m ? null : m))}
            />
            <div className="mt-3">
              <MuscleHeatLegend />
            </div>
            {!hasTraining && (
              <p className="mt-3 flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>No sets logged yet, so everything reads fresh. Finish a workout and this map starts moving.</span>
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Selected muscle detail */}
          {detail ? (
            <Card className={cn(detail.status === 'fatigued' && 'border-danger/30', detail.status === 'fresh' && 'border-success/30')}>
              <CardHeader
                title={MUSCLE_LABEL[detail.muscle]}
                subtitle={FRESHNESS_STATUS_META[detail.status].hint}
                action={<Badge tone={STATUS_TONE[detail.status]}>{FRESHNESS_STATUS_META[detail.status].label}</Badge>}
              />
              <div className="p-5 pt-1 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-2">Freshness</span>
                    <span className="tabular font-bold">{detail.freshness}/100</span>
                  </div>
                  <ProgressBar value={detail.freshness} tone={STATUS_TONE[detail.status]} label={`${MUSCLE_LABEL[detail.muscle]} freshness ${detail.freshness} of 100`} />
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-2xs text-ink-3 uppercase tracking-wide">Last trained</dt>
                    <dd className="font-semibold mt-0.5">
                      {detail.lastTrained ? relativeDay(detail.lastTrained) : 'No sets on record'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-ink-3 uppercase tracking-wide">Sets this week</dt>
                    <dd className="font-semibold mt-0.5 tabular">{detail.weeklySets}</dd>
                  </div>
                  <div>
                    <dt className="text-2xs text-ink-3 uppercase tracking-wide">Remaining load</dt>
                    <dd className="font-semibold mt-0.5 tabular">{detail.load} units</dd>
                  </div>
                </dl>
                {active.filter((n) => n.muscle === detail.muscle).map((n) => (
                  <p key={n.id} className="flex items-start gap-2 text-xs text-ink-2 leading-relaxed rounded-xl bg-danger-soft/60 p-3">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-danger" />
                    <span>
                      {SEVERITY_LABEL[n.severity]} logged here {relativeDay(n.started_date).toLowerCase()}
                      {n.note ? ` — “${n.note}”` : ''}. Exercises that stress it are flagged in your plan.
                    </span>
                  </p>
                ))}
                {exercisesFor(detail.muscle).length > 0 && (
                  <div>
                    <p className="text-2xs text-ink-3 uppercase tracking-wide mb-1.5">Trains this muscle</p>
                    <div className="flex flex-wrap gap-1.5">
                      {exercisesFor(detail.muscle).map((e) => (
                        <Link key={e.slug} to={`/exercises/${e.slug}`}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-line hover:bg-surface-2 transition-colors">
                          {e.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openForm(detail.muscle)} icon={<Plus size={13} />}>
                    Log a niggle here
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-5 flex items-start gap-3">
                <PersonStanding size={20} className="shrink-0 mt-0.5 text-brand-text" />
                <div className="text-sm text-ink-2 leading-relaxed">
                  <p className="font-semibold text-ink">
                    {sorted[0] && sorted[0].status !== 'fresh'
                      ? `${MUSCLE_LABEL[sorted[0].muscle]} is working hardest on recovery right now.`
                      : 'Everything reads fresh.'}
                  </p>
                  <p className="mt-1">
                    Select a muscle on the map or in the list below to see when it was last trained,
                    how much work it has absorbed this week, and what still sits in it.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* All muscles */}
          <Card>
            <CardHeader title="All muscle groups" subtitle="Most fatigued first" dense />
            <ul className="divide-y divide-line">
              {sorted.map((f) => {
                const niggled = active.some((n) => n.muscle === f.muscle);
                return (
                  <li key={f.muscle}>
                    <button
                      type="button"
                      onClick={() => setSelected((cur) => (cur === f.muscle ? null : f.muscle))}
                      aria-pressed={selected === f.muscle}
                      className={cn(
                        'w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-surface-2 transition-colors',
                        selected === f.muscle && 'bg-surface-2',
                      )}
                    >
                      <span className="w-28 shrink-0 text-sm font-medium truncate">{MUSCLE_LABEL[f.muscle]}</span>
                      <span className="flex-1 min-w-16">
                        <ProgressBar value={f.freshness} tone={STATUS_TONE[f.status]} height="sm"
                          label={`${MUSCLE_LABEL[f.muscle]} freshness ${f.freshness} of 100`} />
                      </span>
                      <span className="w-10 shrink-0 tabular text-sm font-bold text-right">{f.freshness}</span>
                      <span className="w-24 shrink-0 text-2xs text-ink-3 text-right hidden sm:block">
                        {f.lastTrained ? relativeDay(f.lastTrained) : 'not trained'}
                      </span>
                      {niggled && <Badge tone="danger" size="sm">niggle</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Today's session check */}
        <Card>
          <CardHeader
            title="Today's session check"
            subtitle={programDay ? programDay.title : 'No programmed session today'}
            action={
              programDay && (
                <Link to="/workout" className="text-xs font-semibold text-brand-text inline-flex items-center gap-1">
                  Open workout <ArrowRight size={12} />
                </Link>
              )
            }
          />
          <div className="p-5 pt-1">
            {!programDay || !programDay.exercises.length ? (
              <EmptyState compact icon={<Sparkles size={20} />} title="Nothing scheduled"
                body="On training days, your planned exercises are cross-checked here against muscle freshness and any active niggles." />
            ) : cautions.length === 0 ? (
              <p className="flex items-start gap-2 text-sm text-ink-2 leading-relaxed">
                <CheckCheck size={16} className="shrink-0 mt-0.5 text-success" />
                <span>All clear — every exercise in today's plan hits muscles that are ready for it.</span>
              </p>
            ) : (
              <ul className="space-y-4">
                {cautions.map((c) => (
                  <li key={c.slug}>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle size={14} className="text-warn shrink-0" />
                      {c.name}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {c.reasons.map((r, i) => (
                        <li key={i} className="text-xs text-ink-3 leading-relaxed pl-6">
                          {MUSCLE_LABEL[r.muscle]}: {r.detail}
                        </li>
                      ))}
                    </ul>
                    {c.alternatives.length > 0 && (
                      <div className="mt-1.5 pl-6 flex flex-wrap items-center gap-1.5">
                        <span className="text-2xs text-ink-3">Could swap for:</span>
                        {c.alternatives.map((slug) => (
                          <Link key={slug} to={`/exercises/${slug}`}
                            className="text-2xs font-medium px-2 py-0.5 rounded-md border border-line hover:bg-surface-2 transition-colors">
                            {getExercise(slug)?.name ?? slug}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cautions.length > 0 && (
              <p className="mt-4 text-2xs text-ink-3 leading-relaxed">
                These are suggestions, not orders — you know your body better than a heat map does.
                Swap exercises from the workout screen if you want to act on any of them.
              </p>
            )}
          </div>
        </Card>

        {/* Weekly balance */}
        <Card>
          <CardHeader title="Weekly balance" subtitle="Working sets, trailing 7 days" />
          <div className="p-5 pt-1 space-y-4">
            <BalancePair label="Push" a={balance.pushSets} labelB="Pull" b={balance.pullSets} />
            <BalancePair label="Quads" a={balance.quadSets} labelB="Hams & glutes" b={balance.posteriorSets} />
            <ul className="space-y-2.5">
              {balance.callouts.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-xs leading-relaxed">
                  {c.tone === 'watch'
                    ? <Scale size={13} className="shrink-0 mt-0.5 text-warn" />
                    : c.tone === 'ok'
                      ? <CheckCheck size={13} className="shrink-0 mt-0.5 text-success" />
                      : <Info size={13} className="shrink-0 mt-0.5 text-ink-3" />}
                  <span className="text-ink-2">
                    <span className="font-semibold">{c.label}.</span> {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Niggle journal */}
      <Card>
        <CardHeader
          title="Niggle journal"
          subtitle="Aches and tight spots, logged before they become injuries"
          action={<Button variant="outline" size="sm" onClick={() => openForm()} icon={<Plus size={13} />}>Log one</Button>}
        />
        {hasSeverePain && (
          <div className="mx-5 mb-1 rounded-xl border border-danger/30 bg-danger-soft/50 p-3">
            <p className="flex items-start gap-2 text-xs text-ink-2 leading-relaxed">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-danger" />
              <span>
                You have logged actual pain. FitHub can flag exercises but it cannot diagnose anything —
                pain that alters how you move, or that persists, deserves a qualified professional's opinion.
              </span>
            </p>
          </div>
        )}
        {active.length === 0 && resolved.length === 0 ? (
          <div className="p-5 pt-2">
            <EmptyState compact icon={<Bandage size={20} />} title="Nothing logged — good"
              body="When something feels off, log it here. Exercises that stress that muscle get flagged in your plan, and you will see how long it lingers." />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {active
                .slice()
                .sort((a, b) => b.severity - a.severity || a.started_date.localeCompare(b.started_date))
                .map((n) => {
                  const days = diffDays(n.started_date, today());
                  return (
                    <li key={n.id} className="flex items-center gap-3 px-5 py-3">
                      <Badge tone={n.severity >= 3 ? 'danger' : n.severity === 2 ? 'warn' : 'default'}>
                        {SEVERITY_LABEL[n.severity]}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {MUSCLE_LABEL[n.muscle]}
                          {n.side !== 'both' && <span className="text-ink-3 font-normal"> · {n.side}</span>}
                        </p>
                        <p className="text-2xs text-ink-3 truncate">
                          {days <= 0 ? 'Started today' : `Day ${days + 1}`}
                          {n.note ? ` — ${n.note}` : ''}
                          {days >= 14 ? ' · lingering for two weeks or more — worth professional eyes' : ''}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void resolveNiggle(n)} icon={<CheckCheck size={13} />}>
                        Resolved
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(n)} aria-label={`Delete ${MUSCLE_LABEL[n.muscle]} niggle`}>
                        <Trash2 size={14} />
                      </Button>
                    </li>
                  );
                })}
            </ul>
            {resolved.length > 0 && (
              <div className="px-5 py-3 border-t border-line">
                <p className="text-2xs text-ink-3 uppercase tracking-wide mb-1.5">Resolved</p>
                <ul className="space-y-1">
                  {resolved.slice(0, 5).map((n) => (
                    <li key={n.id} className="text-xs text-ink-3">
                      {MUSCLE_LABEL[n.muscle]} — {SEVERITY_LABEL[n.severity].toLowerCase()}, {formatDate(n.started_date, 'short')} to {formatDate(n.resolved_date ?? n.started_date, 'short')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add niggle */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Log a niggle"
        description="Tightness, an ache, or pain — logged so your training can steer around it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveNiggle()}>Save niggle</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Muscle"
              value={formMuscle}
              onChange={(e) => setFormMuscle(e.target.value as MuscleGroup)}
              options={TRACKED_MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABEL[m] }))}
            />
            <Select
              label="Side"
              value={formSide}
              onChange={(e) => setFormSide(e.target.value as NiggleSide)}
              options={[
                { value: 'both', label: 'Both / centre' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </div>
          <Select
            label="How bad is it?"
            hint={SEVERITY_HELP[formSeverity]}
            value={String(formSeverity)}
            onChange={(e) => setFormSeverity(Number(e.target.value) as NiggleSeverity)}
            options={([1, 2, 3] as const).map((s) => ({ value: String(s), label: `${s} — ${SEVERITY_LABEL[s]}` }))}
          />
          <Input
            label="When did it start?"
            type="date" value={formDate} max={today()}
            onChange={(e) => setFormDate(e.target.value)}
          />
          <Textarea
            label="Note"
            hint="Optional — what it feels like, what set it off."
            rows={2} value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
          />
          {formSeverity >= 3 && (
            <p className="flex items-start gap-2 text-xs text-ink-2 leading-relaxed rounded-xl bg-danger-soft/60 p-3">
              <AlertTriangle size={13} className="shrink-0 mt-0.5 text-danger" />
              <span>Actual pain is beyond what an app should manage. Log it here for your own record, and consider having it looked at by a professional.</span>
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void del('niggles', deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete this niggle?"
        body={deleteTarget ? `Removes the ${MUSCLE_LABEL[deleteTarget.muscle]} entry entirely, including from your history. If it healed, “Resolved” keeps the record.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}

function BalancePair({ label, a, labelB, b }: { label: string; a: number; labelB: string; b: number }) {
  const total = a + b;
  const pctA = total ? Math.round((a / total) * 100) : 50;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-ink-2 font-medium">{label} <span className="tabular font-bold">{a}</span></span>
        <span className="text-ink-2 font-medium"><span className="tabular font-bold">{b}</span> {labelB}</span>
      </div>
      <div
        className="h-2 rounded-full bg-surface-3 overflow-hidden flex"
        role="img"
        aria-label={`${label} ${a} ${pluralize(a, 'set')} versus ${labelB} ${b}`}
      >
        <div className="h-full bg-brand" style={{ width: `${pctA}%` }} />
        <div className="h-full bg-accent" style={{ width: `${100 - pctA}%` }} />
      </div>
    </div>
  );
}
