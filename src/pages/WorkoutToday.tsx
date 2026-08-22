import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Play, Plus, RefreshCw, Trash2, GripVertical, Info, Repeat, Timer,
  ChevronDown, ChevronUp, Dumbbell, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { MuscleMap } from '@/components/MuscleMap';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { useData } from '@/store/data';
import { useHasFeature, useTodaysProgramDay } from '@/lib/selectors';
import { getExercise } from '@/data/exercises';
import { estimateSessionMinutes, SESSION_KIND_META } from '@/lib/fitness/program';
import { computeMuscleFreshness, sessionCautions } from '@/lib/fitness/freshness';
import { MUSCLE_LABEL } from '@/data/exercises';
import { repScheme } from '@/lib/fitness/calculations';
import { fmtWeight, displayWeight, inputWeightToKg } from '@/lib/fitness/units';
import { uid } from '@/lib/id';
import { today, DAY_NAMES } from '@/lib/date';
import { cn, humanDuration, pluralize } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { PlannedExercise, SessionKind, MuscleGroup, Exercise } from '@/types';

export default function WorkoutToday() {
  const navigate = useNavigate();
  const programDay = useTodaysProgramDay();
  const program = useData((s) => s.programs.find((p) => p.active) ?? null);
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const sessions = useData((s) => s.sessions);
  const allSets = useData((s) => s.sets);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const niggles = useData((s) => s.niggles);
  const startSession = useData((s) => s.startSession);

  const [planned, setPlanned] = useState<PlannedExercise[]>(() => programDay?.exercises ?? []);
  const [title, setTitle] = useState(programDay?.title ?? 'Custom workout');
  const [kind, setKind] = useState<SessionKind>(programDay?.kind ?? 'custom');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<PlannedExercise | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const lastPerformance = useMemo(() => {
    const dates = new Map(sessions.map((s) => [s.id, s.date]));
    const map = new Map<string, { weight: number | null; reps: number | null; date: string }>();
    const sorted = [...allSets]
      .filter((s) => s.completed && !s.is_warmup)
      .sort((a, b) => (dates.get(b.session_id) ?? '').localeCompare(dates.get(a.session_id) ?? ''));
    for (const s of sorted) {
      if (map.has(s.exercise_slug)) continue;
      map.set(s.exercise_slug, { weight: s.weight_kg, reps: s.reps, date: dates.get(s.session_id) ?? '' });
    }
    return map;
  }, [allSets, sessions]);

  const muscles = useMemo(() => {
    const primary = new Set<MuscleGroup>();
    const secondary = new Set<MuscleGroup>();
    for (const pe of planned) {
      const e = getExercise(pe.exercise_slug);
      e?.primary.forEach((m) => primary.add(m));
      e?.secondary.forEach((m) => secondary.add(m));
    }
    return { primary: [...primary], secondary: [...secondary].filter((m) => !primary.has(m)) };
  }, [planned]);

  const estMinutes = estimateSessionMinutes(planned);

  // Body Map cross-check: advisory only, recomputed as the plan is edited.
  const hasBodyMap = useHasFeature('body_map');
  const cautions = useMemo(() => {
    if (!hasBodyMap) return [];
    const freshness = computeMuscleFreshness(allSets, sessions);
    return sessionCautions(planned, freshness, niggles, fitnessProfile?.equipment);
  }, [hasBodyMap, planned, allSets, sessions, niggles, fitnessProfile]);

  const addExercise = (exercise: Exercise) => {
    const scheme = repScheme(
      fitnessProfile?.primary_goal ?? 'general_fitness',
      fitnessProfile?.experience ?? 'beginner',
      exercise.mechanic,
    );
    const isCardio = exercise.type === 'cardio';
    const isTimed = exercise.type === 'timed' || exercise.type === 'mobility';
    setPlanned((p) => [
      ...p,
      {
        id: uid('pe'),
        exercise_slug: exercise.slug,
        order: p.length,
        sets: isCardio ? 1 : scheme.sets,
        target_reps: isCardio || isTimed ? null : scheme.reps,
        target_seconds: isCardio ? 20 * 60 : isTimed ? 40 : null,
        target_weight_kg: null,
        rest_seconds: isCardio ? 0 : scheme.restSeconds,
        notes: '',
        superset_group: null,
      },
    ]);
    if (kind === 'custom' && planned.length === 0) setTitle(`${exercise.category} workout`);
  };

  const swapExercise = (exercise: Exercise) => {
    if (!swapTarget) return;
    setPlanned((p) => p.map((x) => (x.id === swapTarget.id ? { ...x, exercise_slug: exercise.slug } : x)));
    setSwapTarget(null);
    toast.info('Exercise swapped', exercise.name);
  };

  const update = (id: string, patch: Partial<PlannedExercise>) =>
    setPlanned((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const remove = (id: string) => setPlanned((p) => p.filter((x) => x.id !== id).map((x, i) => ({ ...x, order: i })));

  const move = (id: string, direction: -1 | 1) =>
    setPlanned((p) => {
      const index = p.findIndex((x) => x.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= p.length) return p;
      const copy = [...p];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy.map((x, i) => ({ ...x, order: i }));
    });

  const repeatLast = () => {
    const last = [...sessions].filter((s) => s.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) { toast.info('No previous workout to repeat yet'); return; }
    setPlanned(last.planned.map((pe) => ({ ...pe, id: uid('pe') })));
    setTitle(last.title);
    setKind(last.kind);
    toast.success('Loaded your last workout', last.title);
  };

  const start = async () => {
    if (!planned.length) { toast.warn('Add at least one exercise first'); return; }
    setStarting(true);
    try {
      const session = await startSession({
        title, kind, planned,
        programId: program?.id ?? null,
        programDayId: programDay?.id ?? null,
        date: today(),
      });
      navigate(`/workout/live?session=${session.id}`);
    } catch {
      toast.error('Could not start the workout');
      setStarting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-text">
            {DAY_NAMES[new Date().getDay()]}
          </p>
          <h1 className="text-3xl font-black tracking-tight">Today's workout</h1>
          <p className="text-sm text-ink-3 mt-1 tabular">
            {pluralize(planned.length, 'exercise')} · about {humanDuration(estMinutes * 60)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={repeatLast} icon={<Repeat size={14} />}>Repeat last</Button>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} icon={<Plus size={14} />}>Add exercise</Button>
        </div>
      </header>

      {cautions.length > 0 && (
        <Card className="border-warn/40">
          <div className="p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle size={15} className="text-warn shrink-0" />
              Heads-up from your Body Map
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-ink-2 leading-relaxed">
              {cautions.map((c) => (
                <li key={c.slug}>
                  <span className="font-medium">{c.name}</span>
                  {' — '}
                  {c.reasons.map((r) => `${MUSCLE_LABEL[r.muscle]} ${r.detail}`).join('; ')}.
                </li>
              ))}
            </ul>
            <p className="mt-2 text-2xs text-ink-3">
              Suggestions only — train as planned if you feel good, or use the swap button on an
              exercise below. <Link to="/body" className="font-semibold text-brand-text">Open Body Map</Link>
            </p>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1fr,260px] gap-4">
        <div className="space-y-3">
          {/* Session meta */}
          <Card>
            <div className="p-4 grid sm:grid-cols-2 gap-3">
              <Input label="Workout name" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Select
                label="Type"
                value={kind}
                onChange={(e) => setKind(e.target.value as SessionKind)}
                options={(Object.keys(SESSION_KIND_META) as SessionKind[])
                  .filter((k) => k !== 'rest')
                  .map((k) => ({ value: k, label: SESSION_KIND_META[k].label }))}
              />
            </div>
          </Card>

          {planned.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Dumbbell size={22} />}
                title="Nothing planned yet"
                body={programDay?.kind === 'rest'
                  ? 'Today is a scheduled rest day. You can still build a session if you want to train.'
                  : 'Add exercises manually, or repeat your last workout.'}
                action={<Button onClick={() => setPickerOpen(true)} icon={<Plus size={16} />}>Add exercise</Button>}
                secondary={<Button variant="outline" onClick={repeatLast} icon={<Repeat size={16} />}>Repeat last</Button>}
              />
            </Card>
          ) : (
            <ul className="space-y-2">
              {planned.map((pe, index) => {
                const exercise = getExercise(pe.exercise_slug);
                const last = lastPerformance.get(pe.exercise_slug);
                const isOpen = expanded === pe.id;
                if (!exercise) return null;
                return (
                  <li key={pe.id}>
                    <Card className={cn('transition-colors', isOpen && 'border-brand/40')}>
                      <div className="flex items-center gap-3 p-3.5">
                        <span className="hidden sm:flex flex-col gap-0.5 shrink-0" aria-hidden>
                          <button type="button" onClick={() => move(pe.id, -1)} disabled={index === 0}
                            aria-label="Move up"
                            className="h-4 w-5 grid place-items-center text-ink-3 hover:text-ink disabled:opacity-25">
                            <ChevronUp size={13} />
                          </button>
                          <GripVertical size={13} className="text-ink-3 mx-auto" />
                          <button type="button" onClick={() => move(pe.id, 1)} disabled={index === planned.length - 1}
                            aria-label="Move down"
                            className="h-4 w-5 grid place-items-center text-ink-3 hover:text-ink disabled:opacity-25">
                            <ChevronDown size={13} />
                          </button>
                        </span>

                        <span className="h-9 w-9 shrink-0 rounded-xl bg-surface-2 grid place-items-center text-2xs font-bold tabular text-ink-2">
                          {index + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : pe.id)}
                          aria-expanded={isOpen}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="font-semibold text-sm truncate">{exercise.name}</p>
                          <p className="text-2xs text-ink-3 tabular">
                            {pe.target_seconds
                              ? `${pe.sets} × ${pe.target_seconds >= 60 ? `${Math.round(pe.target_seconds / 60)} min` : `${pe.target_seconds}s`}`
                              : `${pe.sets} sets × ${pe.target_reps} reps`}
                            {pe.rest_seconds > 0 && ` · ${pe.rest_seconds}s rest`}
                            {last?.weight != null && ` · last ${fmtWeight(last.weight, units)} × ${last.reps}`}
                          </p>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSwapTarget(pe)}
                            aria-label={`Swap ${exercise.name}`}
                            className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2"
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(pe.id)}
                            aria-label={`Remove ${exercise.name}`}
                            className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-danger hover:bg-danger-soft"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="px-3.5 pb-3.5 pt-1 border-t border-line animate-fade-in">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                            <Input
                              label="Sets" type="number" inputMode="numeric" min={1} max={10}
                              value={pe.sets}
                              onChange={(e) => update(pe.id, { sets: Math.max(1, Number(e.target.value) || 1) })}
                            />
                            {pe.target_seconds === null ? (
                              <Input
                                label="Reps" type="number" inputMode="numeric" min={1} max={100}
                                value={pe.target_reps ?? ''}
                                onChange={(e) => update(pe.id, { target_reps: Number(e.target.value) || null })}
                              />
                            ) : (
                              <Input
                                label="Seconds" type="number" inputMode="numeric" min={5}
                                value={pe.target_seconds}
                                onChange={(e) => update(pe.id, { target_seconds: Number(e.target.value) || 30 })}
                              />
                            )}
                            <Input
                              label={`Target (${units === 'metric' ? 'kg' : 'lb'})`} type="number" inputMode="decimal" step="0.5"
                              value={displayWeight(pe.target_weight_kg, units) ?? ''}
                              placeholder={last?.weight != null ? String(displayWeight(last.weight, units)) : '—'}
                              onChange={(e) => update(pe.id, {
                                target_weight_kg: e.target.value ? inputWeightToKg(Number(e.target.value), units) : null,
                              })}
                            />
                            <Input
                              label="Rest (s)" type="number" inputMode="numeric" min={0} step={15}
                              value={pe.rest_seconds}
                              onChange={(e) => update(pe.id, { rest_seconds: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge tone="muted" size="sm" icon={<Icon name="Target" size={10} />}>
                              {exercise.primary.join(', ').replace(/_/g, ' ')}
                            </Badge>
                            <Badge tone="muted" size="sm">{exercise.mechanic}</Badge>
                            <Link to={`/exercises/${exercise.slug}`} className="text-2xs text-brand-text font-medium hover:underline ml-auto">
                              Form guide →
                            </Link>
                          </div>

                          {exercise.safety.length > 0 && (
                            <p className="mt-2.5 flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                              <Info size={12} className="shrink-0 mt-0.5" />
                              <span>{exercise.safety[0]}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <Button variant="outline" block onClick={() => setPickerOpen(true)} icon={<Plus size={16} />}>
            Add another exercise
          </Button>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <Card>
            <CardHeader title="Target muscles" dense />
            <div className="p-4 pt-2">
              {planned.length ? (
                <MuscleMap primary={muscles.primary} secondary={muscles.secondary} view="both" size={64} showLabels />
              ) : (
                <p className="text-xs text-ink-3 text-center py-6">Add exercises to see what you'll train.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Session summary" dense />
            <dl className="p-4 pt-2 space-y-2 text-sm">
              {[
                ['Exercises', String(planned.length)],
                ['Working sets', String(planned.reduce((a, p) => a + p.sets, 0))],
                ['Estimated time', humanDuration(estMinutes * 60)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-ink-3">{label}</dt>
                  <dd className="font-semibold tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="hidden lg:block sticky top-24">
            <Button size="xl" block onClick={() => void start()} loading={starting} disabled={!planned.length} icon={<Play size={18} />}>
              START WORKOUT
            </Button>
            <p className="mt-2 text-2xs text-ink-3 text-center">
              <Timer size={11} className="inline -mt-0.5 mr-1" />
              Rest timers start automatically after each set.
            </p>
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 px-4 pb-3 pointer-events-none">
        <div className="pointer-events-auto">
          <Button size="xl" block onClick={() => void start()} loading={starting} disabled={!planned.length} icon={<Zap size={18} />}>
            START WORKOUT
          </Button>
        </div>
      </div>

      <ExercisePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        excludeSlugs={planned.map((p) => p.exercise_slug)}
      />
      <ExercisePickerModal
        open={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        onPick={swapExercise}
        title="Swap exercise"
        excludeSlugs={planned.map((p) => p.exercise_slug)}
        preferCategory={swapTarget ? getExercise(swapTarget.exercise_slug)?.category : undefined}
      />
    </div>
  );
}
