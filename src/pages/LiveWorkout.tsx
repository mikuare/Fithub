import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronLeft, ChevronRight, Flag, Info, Minus, Plus, Timer as TimerIcon,
  X, BookOpen, Undo2, Flame, ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { MuscleMap } from '@/components/MuscleMap';
import { RestOverlay } from '@/components/workout/RestOverlay';
import { PlateCalculator } from '@/components/workout/PlateCalculator';
import { selectActiveSession, useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { primeAudio } from '@/lib/audio';
import { useNow } from '@/lib/hooks';
import { getExercise } from '@/data/exercises';
import { suggestProgression, buildHistory } from '@/lib/fitness/progression';
import { estimate1RM } from '@/lib/fitness/calculations';
import { displayWeight, fmtWeight, inputWeightToKg, weightStep, weightUnit } from '@/lib/fitness/units';
import { uid } from '@/lib/id';
import { nowISO, relativeDay } from '@/lib/date';
import { cn, formatDuration, round } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { WorkoutSet } from '@/types';

export default function LiveWorkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessions = useData((s) => s.sessions);
  const allSets = useData((s) => s.sets);
  const prefs = useData((s) => s.preferences);
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const logSet = useData((s) => s.logSet);
  const removeSet = useData((s) => s.removeSet);
  const abandonSession = useData((s) => s.abandonSession);
  const put = useData((s) => s.put);
  const activeSession = useData(selectActiveSession);
  const timer = useTimer();

  const sessionId = params.get('session');
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? activeSession,
    [sessions, sessionId, activeSession],
  );

  const units = prefs?.units ?? 'metric';
  const [index, setIndex] = useState(0);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [seconds, setSeconds] = useState('');
  const [isWarmup, setIsWarmup] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const touchStart = useRef<number | null>(null);
  const now = useNow(1000);

  const planned = session?.planned ?? [];
  const current = planned[index];
  const exercise = current ? getExercise(current.exercise_slug) : undefined;
  const nextPlanned = planned[index + 1];
  const nextExercise = nextPlanned ? getExercise(nextPlanned.exercise_slug) : undefined;

  const sessionSets = useMemo(
    () => allSets.filter((s) => s.session_id === session?.id).sort((a, b) => a.set_index - b.set_index),
    [allSets, session?.id],
  );
  const currentSets = useMemo(
    () => sessionSets.filter((s) => s.exercise_slug === current?.exercise_slug),
    [sessionSets, current?.exercise_slug],
  );
  const workingDone = currentSets.filter((s) => !s.is_warmup).length;

  const history = useMemo(() => {
    if (!current) return [];
    const dates = new Map(sessions.map((x) => [x.id, x.date]));
    return buildHistory(
      allSets.filter((s) => s.exercise_slug === current.exercise_slug && s.session_id !== session?.id),
      (id) => dates.get(id) ?? null,
    );
  }, [allSets, sessions, current, session?.id]);

  const suggestion = useMemo(
    () => (exercise && current
      ? suggestProgression(history, exercise, fitnessProfile?.experience ?? 'beginner', current.target_reps ?? 10, current.sets)
      : null),
    [history, exercise, current, fitnessProfile?.experience],
  );

  const elapsed = session?.started_at ? Math.floor((now - new Date(session.started_at).getTime()) / 1000) : 0;
  const totalPlannedSets = planned.reduce((a, p) => a + p.sets, 0);
  const totalDone = sessionSets.filter((s) => !s.is_warmup).length;

  /* Prefill the inputs from the plan, then the suggestion, then last session. */
  useEffect(() => {
    if (!current) return;
    const last = history[0];
    const targetKg = current.target_weight_kg ?? suggestion?.suggestedWeightKg ?? last?.topWeight ?? null;
    setWeight(targetKg !== null ? String(displayWeight(targetKg, units) ?? '') : '');
    setReps(current.target_reps !== null ? String(current.target_reps) : '');
    setSeconds(current.target_seconds !== null ? String(current.target_seconds) : '');
    setIsWarmup(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, current?.id]);

  useEffect(() => { primeAudio(); }, []);

  useEffect(() => {
    if (!session) return;
    setNotes(session.notes);
  }, [session]);

  // Warn before leaving with an unfinished session (refresh / close tab).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center px-6 bg-bg">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold">No workout in progress</h1>
          <p className="text-sm text-ink-3 mt-2">Start a session from today's workout to enter workout mode.</p>
          <Button className="mt-5" onClick={() => navigate('/workout')}>Go to today's workout</Button>
        </div>
      </div>
    );
  }

  const isTimed = current?.target_seconds !== null && current?.target_seconds !== undefined;
  const step = weightStep(units);

  const bump = (delta: number) => {
    const n = Number(weight) || 0;
    setWeight(String(round(Math.max(0, n + delta), 2)));
  };

  const completeSet = async () => {
    if (!current || !session) return;
    const weightKg = weight ? inputWeightToKg(Number(weight), units) : null;
    const repCount = reps ? Number(reps) : null;
    const secondCount = seconds ? Number(seconds) : null;

    if (!isTimed && !repCount) { toast.warn('Enter the reps you completed'); return; }
    if (isTimed && !secondCount) { toast.warn('Enter how long you held it'); return; }

    const row: WorkoutSet = {
      id: uid('set'),
      session_id: session.id,
      exercise_slug: current.exercise_slug,
      set_index: currentSets.length,
      weight_kg: weightKg,
      reps: repCount,
      seconds: isTimed ? secondCount : null,
      distance_km: null,
      rpe: null,
      completed: true,
      is_warmup: isWarmup,
      logged_at: nowISO(),
    };
    await logSet(row);

    const nowDone = currentSets.filter((s) => !s.is_warmup).length + (isWarmup ? 0 : 1);
    const exerciseFinished = nowDone >= current.sets;

    // Rest only makes sense between sets, not after the last one.
    if (current.rest_seconds > 0 && !exerciseFinished && prefs?.workout.auto_start_rest !== false) {
      timer.startRest(current.rest_seconds);
    }

    if (exerciseFinished && index < planned.length - 1) {
      toast.success(`${getExercise(current.exercise_slug)?.name} complete`, 'Moving to the next exercise.');
      setTimeout(() => setIndex((i) => Math.min(i + 1, planned.length - 1)), 400);
    }
    setIsWarmup(false);
  };

  const undoLastSet = async () => {
    const last = currentSets[currentSets.length - 1];
    if (!last) return;
    await removeSet(last.id);
    toast.info('Set removed');
  };

  const finish = async () => {
    if (!session) return;
    setFinishing(true);
    timer.stop();
    try {
      if (notes !== session.notes) await put('workout_sessions', { ...session, notes });
      navigate(`/workout/complete/${session.id}`, { replace: true });
    } finally {
      setFinishing(false);
    }
  };

  const exit = async () => {
    timer.stop();
    if (totalDone === 0) {
      await abandonSession(session.id);
      toast.info('Workout discarded', 'Nothing was logged, so nothing was saved.');
    } else {
      toast.info('Workout paused', 'Resume it any time from the banner at the top.');
    }
    navigate('/');
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 70) {
      if (delta < 0 && index < planned.length - 1) setIndex(index + 1);
      if (delta > 0 && index > 0) setIndex(index - 1);
    }
    touchStart.current = null;
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-30 glass border-b border-line pt-safe">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label="Exit workout mode"
            className="h-10 w-10 -ml-2 grid place-items-center rounded-xl text-ink-2 hover:bg-surface-2"
          >
            <X size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate leading-tight">{session.title}</p>
            <p className="text-2xs text-ink-3 tabular">
              Exercise {index + 1} of {planned.length} · {totalDone}/{totalPlannedSets} sets
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-mono tabular font-semibold shrink-0">
            <TimerIcon size={14} className="text-ink-3" />
            {formatDuration(elapsed, elapsed >= 3600)}
          </span>
        </div>
        <div className="h-0.5 bg-surface-2">
          <div
            className="h-full bg-brand transition-[width] duration-500"
            style={{ width: `${totalPlannedSets ? (totalDone / totalPlannedSets) * 100 : 0}%` }}
            role="progressbar"
            aria-valuenow={totalDone}
            aria-valuemax={totalPlannedSets}
            aria-label="Workout progress"
          />
        </div>
      </header>

      {/* ---------- Body ---------- */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 pb-56">
        {!current || !exercise ? (
          <div className="py-20 text-center">
            <p className="text-ink-3">This workout has no exercises.</p>
            <Button className="mt-4" onClick={() => navigate('/workout')}>Add some</Button>
          </div>
        ) : (
          <>
            {/* Exercise switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                aria-label="Previous exercise"
                className="h-10 w-10 grid place-items-center rounded-xl border border-line text-ink-2 disabled:opacity-30 hover:bg-surface-2"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                {planned.map((pe, i) => {
                  const done = sessionSets.filter((s) => s.exercise_slug === pe.exercise_slug && !s.is_warmup).length >= pe.sets;
                  return (
                    <button
                      key={pe.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to exercise ${i + 1}`}
                      aria-current={i === index}
                      className={cn(
                        'shrink-0 h-10 min-w-10 px-2.5 rounded-xl border text-xs font-bold tabular transition-colors',
                        i === index ? 'bg-brand text-brand-contrast border-brand'
                          : done ? 'bg-success-soft text-success border-success/30'
                          : 'border-line text-ink-3 hover:border-line-strong',
                      )}
                    >
                      {done && i !== index ? <Check size={13} className="mx-auto" /> : i + 1}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(planned.length - 1, i + 1))}
                disabled={index === planned.length - 1}
                aria-label="Next exercise"
                className="h-10 w-10 grid place-items-center rounded-xl border border-line text-ink-2 disabled:opacity-30 hover:bg-surface-2"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Exercise header */}
            <div className="mt-5 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-black tracking-tight leading-tight">{exercise.name}</h1>
                <p className="mt-1.5 text-sm text-ink-3 capitalize">
                  {exercise.primary.join(' · ').replace(/_/g, ' ')}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="brand" size="sm">
                    Set {Math.min(workingDone + 1, current.sets)} of {current.sets}
                  </Badge>
                  {isTimed ? (
                    <Badge tone="muted" size="sm">Target {current.target_seconds}s</Badge>
                  ) : (
                    <Badge tone="muted" size="sm">Target {current.target_reps} reps</Badge>
                  )}
                  {current.rest_seconds > 0 && <Badge tone="muted" size="sm">{current.rest_seconds}s rest</Badge>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="shrink-0 rounded-2xl border border-line bg-surface-2 p-2 hover:border-line-strong transition-colors"
                aria-label="Show form guide"
              >
                <MuscleMap primary={exercise.primary} secondary={exercise.secondary} view="front" size={44} />
                <span className="block mt-1 text-[9px] text-ink-3 font-medium uppercase tracking-wide">Form</span>
              </button>
            </div>

            {/* Previous performance & suggestion */}
            <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
              <div className="card p-3.5">
                <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3">Previous</p>
                {history[0] ? (
                  <>
                    <p className="mt-1.5 text-sm tabular">
                      {history[0].sets.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && <span className="text-ink-3"> · </span>}
                          {s.weight_kg !== null ? `${displayWeight(s.weight_kg, units)}×${s.reps}` : `${s.reps ?? s.seconds}${s.reps ? '' : 's'}`}
                        </span>
                      ))}
                    </p>
                    <p className="mt-1 text-2xs text-ink-3">{relativeDay(history[0].date)}</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-3">First time logging this exercise.</p>
                )}
              </div>

              {suggestion && (
                <div className={cn('card p-3.5', suggestion.kind === 'increase_load' && 'border-brand/40 bg-brand-soft/30')}>
                  <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3">Suggestion</p>
                  <p className="mt-1.5 text-sm font-semibold">{suggestion.headline}</p>
                  <p className="mt-1 text-2xs text-ink-3 leading-relaxed line-clamp-3">{suggestion.detail}</p>
                </div>
              )}
            </div>

            {/* Logged sets */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <ListChecks size={15} className="text-ink-3" /> Sets
                </h2>
                {currentSets.length > 0 && (
                  <button type="button" onClick={() => void undoLastSet()} className="text-2xs text-ink-3 hover:text-danger inline-flex items-center gap-1">
                    <Undo2 size={12} /> Undo last
                  </button>
                )}
              </div>

              <ul className="mt-2 space-y-1.5">
                {Array.from({ length: Math.max(current.sets, currentSets.filter((s) => !s.is_warmup).length) }, (_, i) => {
                  const working = currentSets.filter((s) => !s.is_warmup);
                  const logged = working[i];
                  const isCurrent = !logged && i === working.length;
                  return (
                    <li
                      key={i}
                      className={cn(
                        'flex items-center gap-3 px-3.5 h-12 rounded-xl border text-sm',
                        logged ? 'border-success/30 bg-success-soft/40'
                          : isCurrent ? 'border-brand/50 bg-brand-soft/30'
                          : 'border-line bg-surface',
                      )}
                    >
                      <span className="w-6 text-2xs font-bold tabular text-ink-3">{i + 1}</span>
                      {logged ? (
                        <>
                          <span className="tabular font-semibold">
                            {logged.weight_kg !== null && `${fmtWeight(logged.weight_kg, units)} × `}
                            {logged.seconds !== null ? `${logged.seconds}s` : `${logged.reps} reps`}
                          </span>
                          {logged.weight_kg && logged.reps && (
                            <span className="text-2xs text-ink-3 tabular">
                              e1RM {fmtWeight(estimate1RM(logged.weight_kg, logged.reps), units, 0)}
                            </span>
                          )}
                          <Check size={16} className="ml-auto text-success shrink-0" aria-label="Completed" />
                        </>
                      ) : (
                        <span className={cn('tabular', isCurrent ? 'text-ink-2 font-medium' : 'text-ink-3')}>
                          Target: {isTimed ? `${current.target_seconds}s` : `${current.target_reps} reps`}
                          {current.target_weight_kg ? ` × ${fmtWeight(current.target_weight_kg, units)}` : ''}
                        </span>
                      )}
                    </li>
                  );
                })}
                {currentSets.filter((s) => s.is_warmup).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3.5 h-10 rounded-xl border border-line bg-surface-2 text-sm">
                    <Badge size="sm" tone="muted">Warm-up</Badge>
                    <span className="tabular text-ink-2">
                      {s.weight_kg !== null && `${fmtWeight(s.weight_kg, units)} × `}{s.reps ?? s.seconds}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {nextExercise && (
              <p className="mt-5 text-sm text-ink-3">
                Up next: <span className="font-semibold text-ink-2">{nextExercise.name}</span>
              </p>
            )}
          </>
        )}
      </main>

      {/* ---------- Input dock ---------- */}
      {current && exercise && (
        <div className="fixed bottom-0 inset-x-0 z-20 glass border-t border-line pb-safe">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-end gap-2.5">
              {!isTimed && (
                <div className="flex-1">
                  <label htmlFor="set-weight" className="block text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-1">
                    Weight ({weightUnit(units)})
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button" onClick={() => bump(-step)} aria-label={`Decrease weight by ${step}`}
                      className="h-12 w-10 shrink-0 grid place-items-center rounded-xl border border-line bg-surface-2 active:scale-95"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      id="set-weight"
                      type="number" inputMode="decimal" step="0.5"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="0"
                      className="h-12 w-full min-w-0 text-center text-lg font-bold tabular bg-surface-2 border border-line rounded-xl"
                    />
                    <button
                      type="button" onClick={() => bump(step)} aria-label={`Increase weight by ${step}`}
                      className="h-12 w-10 shrink-0 grid place-items-center rounded-xl border border-line bg-surface-2 active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className={cn(isTimed ? 'flex-1' : 'w-28')}>
                <label htmlFor="set-reps" className="block text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-1">
                  {isTimed ? 'Seconds' : 'Reps'}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => isTimed
                      ? setSeconds(String(Math.max(0, (Number(seconds) || 0) - 5)))
                      : setReps(String(Math.max(0, (Number(reps) || 0) - 1)))}
                    aria-label={isTimed ? 'Decrease seconds' : 'Decrease reps'}
                    className="h-12 w-10 shrink-0 grid place-items-center rounded-xl border border-line bg-surface-2 active:scale-95"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    id="set-reps"
                    type="number" inputMode="numeric"
                    value={isTimed ? seconds : reps}
                    onChange={(e) => (isTimed ? setSeconds(e.target.value) : setReps(e.target.value))}
                    placeholder="0"
                    className="h-12 w-full min-w-0 text-center text-lg font-bold tabular bg-surface-2 border border-line rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => isTimed
                      ? setSeconds(String((Number(seconds) || 0) + 5))
                      : setReps(String((Number(reps) || 0) + 1))}
                    aria-label={isTimed ? 'Increase seconds' : 'Increase reps'}
                    className="h-12 w-10 shrink-0 grid place-items-center rounded-xl border border-line bg-surface-2 active:scale-95"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {prefs?.workout.plate_calculator && exercise.equipment.includes('barbell') && Number(weight) > 0 && (
              <div className="mt-2">
                <PlateCalculator
                  totalKg={inputWeightToKg(Number(weight), units)}
                  barKg={prefs.workout.bar_weight_kg}
                  units={units}
                />
              </div>
            )}

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsWarmup((v) => !v)}
                aria-pressed={isWarmup}
                className={cn(
                  'h-12 px-3 rounded-xl border text-xs font-semibold shrink-0 transition-colors',
                  isWarmup ? 'bg-warn-soft border-warn/40 text-warn' : 'border-line text-ink-3',
                )}
              >
                <Flame size={14} className="inline -mt-0.5 mr-1" />
                Warm-up
              </button>

              <Button size="xl" className="flex-1" onClick={() => void completeSet()} icon={<Check size={19} />}>
                COMPLETE SET
              </Button>

              <button
                type="button"
                onClick={() => setShowNotes(true)}
                aria-label="Workout notes"
                className="h-12 w-12 shrink-0 grid place-items-center rounded-xl border border-line text-ink-3 hover:text-ink"
              >
                <Info size={18} />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              {current.rest_seconds > 0 && (
                <button
                  type="button"
                  onClick={() => timer.startRest(current.rest_seconds)}
                  className="flex-1 h-9 rounded-lg border border-line text-xs font-medium text-ink-2 hover:bg-surface-2"
                >
                  Start {current.rest_seconds}s rest
                </button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => void finish()}
                loading={finishing}
                icon={<Flag size={14} />}
              >
                Finish workout
              </Button>
            </div>
          </div>
        </div>
      )}

      <RestOverlay nextLabel={nextExercise?.name} />

      {/* Form guide */}
      <Modal open={showGuide} onClose={() => setShowGuide(false)} title={exercise?.name ?? 'Form guide'} size="lg">
        {exercise && (
          <div className="space-y-5">
            <div className="flex justify-center py-2">
              <MuscleMap primary={exercise.primary} secondary={exercise.secondary} view="both" size={92} showLabels />
            </div>
            <section>
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><BookOpen size={14} /> How to perform it</h3>
              <ol className="mt-2 space-y-2">
                {exercise.instructions.map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-2 leading-relaxed">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-surface-2 grid place-items-center text-2xs font-bold tabular">{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>
            {exercise.mistakes.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-warn">Common mistakes</h3>
                <ul className="mt-2 space-y-1.5">
                  {exercise.mistakes.map((m, i) => (
                    <li key={i} className="text-sm text-ink-2 leading-relaxed flex gap-2">
                      <span className="text-warn shrink-0" aria-hidden>•</span>{m}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {exercise.safety.length > 0 && (
              <section className="p-3.5 rounded-xl bg-danger-soft border border-danger/25">
                <h3 className="text-sm font-semibold text-danger">Safety</h3>
                <ul className="mt-1.5 space-y-1.5">
                  {exercise.safety.map((s, i) => <li key={i} className="text-sm text-ink-2 leading-relaxed">{s}</li>)}
                </ul>
              </section>
            )}
          </div>
        )}
      </Modal>

      {/* Notes */}
      <Modal
        open={showNotes}
        onClose={() => setShowNotes(false)}
        title="Workout notes"
        description="Anything worth remembering — how a lift felt, a niggle, a change you made."
        footer={
          <Button block onClick={async () => { await put('workout_sessions', { ...session, notes }); setShowNotes(false); toast.success('Note saved'); }}>
            Save note
          </Button>
        }
      >
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Left shoulder felt slightly uncomfortable during incline press."
          rows={5}
        />
        <p className="mt-2 text-2xs text-ink-3">
          Notes appear on your workout history and can inform future exercise choices.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmExit}
        onClose={() => setConfirmExit(false)}
        onConfirm={() => void exit()}
        title={totalDone === 0 ? 'Discard this workout?' : 'Leave workout mode?'}
        body={totalDone === 0
          ? 'You have not logged any sets, so nothing will be saved.'
          : 'Your logged sets are already saved. You can resume this session from the banner at the top of any screen.'}
        confirmLabel={totalDone === 0 ? 'Discard' : 'Leave'}
        tone={totalDone === 0 ? 'danger' : 'primary'}
      />
    </div>
  );
}
