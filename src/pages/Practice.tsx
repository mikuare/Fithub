import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Clock, Info, Minus, Pause, Play, Plus, RotateCcw,
  Search, SearchX, SkipForward, Sparkles, Timer as TimerIcon, Volume2, VolumeX,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { ProgressRing } from '@/components/ui/Progress';
import { EquipmentArt } from '@/components/EquipmentArt';
import { useData } from '@/store/data';
import { currentPhase, remainingMs, useTimer } from '@/store/timer';
import { primeAudio } from '@/lib/audio';
import { EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import {
  buildPractice, practiceToPhases, searchEquipment, PRACTICE_GOALS, PRACTICE_TARGETS,
  type Practice, type PracticeStep, type PracticeTarget,
} from '@/lib/fitness/practice';
import { cn, formatDuration } from '@/lib/utils';
import type { Equipment, GoalKind } from '@/types';

/* ============================================================
   Practice builder
   Kit → target → a session you can actually run. The generated
   steps come out of the real exercise library, and the run
   button hands them to the shared timer, so the countdown knows
   which movement you are on.
   ============================================================ */

type Choice = { kind: 'known'; equipment: Equipment } | { kind: 'unknown'; label: string };

export default function Practice() {
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PracticeTarget>('abs');
  const [goal, setGoal] = useState<GoalKind>(fitnessProfile?.primary_goal ?? 'build_muscle');

  const owned = useMemo(
    () => new Set<Equipment>([...(fitnessProfile?.equipment ?? []), 'bodyweight']),
    [fitnessProfile?.equipment],
  );
  const options = useMemo(
    () => [...EQUIPMENT_OPTIONS].sort((a, b) => Number(owned.has(b)) - Number(owned.has(a))),
    [owned],
  );

  const matches = useMemo(() => (query.trim().length >= 2 ? searchEquipment(query) : []), [query]);

  const practice = useMemo(() => {
    if (!choice) return null;
    return buildPractice({
      equipment: choice.kind === 'known' ? choice.equipment : null,
      unknownLabel: choice.kind === 'unknown' ? choice.label : undefined,
      target,
      goal,
      experience: fitnessProfile?.experience ?? 'beginner',
    });
  }, [choice, target, goal, fitnessProfile?.experience]);

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        eyebrow="Practice"
        title="Practice builder"
        subtitle="Pick the kit you are using and what you want to train. FitHub builds the steps, the sets and the rest — then runs the whole thing on a timer."
      />

      {/* ---------- 1. Equipment ---------- */}
      <Card>
        <div className="p-4 sm:p-5">
          <StepHeading n={1} title="What are you using?" />

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {options.map((eq) => {
              const on = choice?.kind === 'known' && choice.equipment === eq;
              return (
                <button
                  key={eq}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => { setChoice({ kind: 'known', equipment: eq }); setSearching(false); }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition-all',
                    on ? 'border-brand/50 bg-brand-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
                  )}
                >
                  <EquipmentArt equipment={eq} className="h-9 w-12 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{EQUIPMENT_LABEL[eq] ?? eq}</span>
                  {owned.has(eq) && <span className="shrink-0 text-2xs font-bold uppercase tracking-wide text-brand-text">Yours</span>}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => { setSearching(true); setChoice(null); }}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border border-dashed p-2.5 text-left text-sm font-medium transition-all',
                searching ? 'border-brand/50 bg-brand-soft text-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-brand/40',
              )}
            >
              <span className="grid h-9 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-3">
                <Search size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">Other — search for it</span>
            </button>
          </div>

          {searching && (
            <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-3">
              <Input
                label="What do you have?"
                hint="Type the name of your equipment — brand names and regional names usually work."
                placeholder="e.g. TRX, swiss ball, ez curl bar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />

              {query.trim().length >= 2 && (
                matches.length > 0 ? (
                  <ul className="mt-3 space-y-1.5">
                    {matches.map((m) => (
                      <li key={m.equipment}>
                        <button
                          type="button"
                          onClick={() => { setChoice({ kind: 'known', equipment: m.equipment }); setSearching(false); }}
                          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-2.5 text-left transition-colors hover:border-brand/40"
                        >
                          <EquipmentArt equipment={m.equipment} className="h-9 w-12 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold truncate">{m.label}</span>
                            <span className="block text-2xs text-ink-3 truncate">{m.reason}</span>
                          </span>
                          <ArrowRight size={14} className="shrink-0 text-ink-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  /* No pretending. Say it is unknown, then still be useful. */
                  <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft/40 p-3">
                    <p className="flex items-start gap-2 text-sm text-ink-2 leading-relaxed">
                      <SearchX size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                      <span>
                        <strong className="font-semibold text-ink">FitHub does not know “{query.trim()}”.</strong>{' '}
                        Nothing in the equipment list matches it. You can still get a practice for the muscles you
                        want — it will be bodyweight work, and the steps carry over if your kit loads the same movement.
                      </span>
                    </p>
                    <Button
                      className="mt-3"
                      size="sm"
                      onClick={() => { setChoice({ kind: 'unknown', label: query.trim() }); setSearching(false); }}
                    >
                      Build me a practice anyway
                    </Button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ---------- 2. Target ---------- */}
      <Card>
        <div className="p-4 sm:p-5">
          <StepHeading n={2} title="What do you want to train?" />
          <div className="mt-3 flex flex-wrap gap-2">
            {PRACTICE_TARGETS.map((t) => (
              <Chip key={t.value} on={target === t.value} onClick={() => setTarget(t.value)}>{t.label}</Chip>
            ))}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-3">And what for?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRACTICE_GOALS.map((g) => (
              <Chip key={g.value} on={goal === g.value} onClick={() => setGoal(g.value)} title={g.hint}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* ---------- 3. The practice ---------- */}
      {practice ? (
        <PracticeSession practice={practice} />
      ) : (
        <Card>
          <div className="p-8 text-center">
            <Sparkles size={24} className="mx-auto text-ink-3" aria-hidden />
            <p className="mt-3 font-semibold">Pick your equipment to see the steps</p>
            <p className="mt-1 text-sm text-ink-3">
              Choose a piece of kit above — or search for one that is not listed — and the practice appears here.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-bold">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-brand-contrast text-xs font-black tabular">
        {n}
      </span>
      {title}
    </h2>
  );
}

function Chip({ on, onClick, children, title }: {
  on: boolean; onClick: () => void; children: ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
        on ? 'border-brand/50 bg-brand-soft text-brand-text' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- the generated session ---------------- */

function PracticeSession({ practice }: { practice: Practice }) {
  const timer = useTimer();
  const [run, setRun] = useState<{ stepOfPhase: number[] } | null>(null);

  const phase = currentPhase(timer);
  const active = run !== null && timer.mode !== 'idle' && phase !== null;
  const activeStep = active ? practice.steps[run.stepOfPhase[timer.phaseIndex] ?? 0] : null;

  const start = () => {
    primeAudio();
    const built = practiceToPhases(practice);
    setRun({ stepOfPhase: built.stepOfPhase });
    timer.start(built.phases, { mode: 'interval', title: `${practice.equipmentLabel} — ${practice.targetLabel}` });
  };

  const stop = () => { timer.stop(); setRun(null); };

  return (
    <Card className="border-brand/30">
      <div className="border-b border-line bg-brand-soft/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <StepHeading n={3} title="Your practice" />
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
                <Badge tone="brand" size="sm">{practice.equipmentLabel}</Badge>
                <Badge tone="muted" size="sm">{practice.targetLabel}</Badge>
                <span className="inline-flex items-center gap-1.5 text-ink-3">
                  <Clock size={13} aria-hidden /> about {Math.round(practice.totalSeconds / 60)} minutes
                </span>
              </p>
            </div>
            {!active && (
              <Button onClick={start} icon={<Play size={16} />} size="lg">Start with timer</Button>
            )}
          </div>

          {practice.note && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface/70 p-3 text-xs text-ink-2 leading-relaxed">
              <Info size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <span>{practice.note}</span>
            </p>
          )}
        </div>

        {active && phase && activeStep && (
          <RunningTimer step={activeStep} onStop={stop} />
        )}

        <ol className="divide-y divide-line">
          {practice.steps.map((step, index) => (
            <StepRow
              key={`${step.name}-${index}`}
              step={step}
              index={index}
              current={active && run.stepOfPhase[timer.phaseIndex] === index}
            />
          ))}
        </ol>
    </Card>
  );
}

function RunningTimer({ step, onStop }: { step: PracticeStep; onStop: () => void }) {
  const timer = useTimer();
  const phase = currentPhase(timer);
  const remaining = remainingMs(timer);
  const seconds = Math.ceil(remaining / 1000);
  const pct = phase && phase.seconds > 0 ? (remaining / (phase.seconds * 1000)) * 100 : 0;
  if (!phase) return null;

  const resting = phase.kind === 'rest';

  return (
    <div className="flex flex-col items-center border-b border-line p-5">
      <div className="flex items-center gap-2">
        <Badge tone={resting ? 'info' : 'brand'}>{phase.label}</Badge>
        <button
          type="button"
          onClick={() => { primeAudio(); timer.setSound(!timer.soundEnabled); }}
          aria-pressed={timer.soundEnabled}
          aria-label={timer.soundEnabled ? 'Mute timer sounds' : 'Unmute timer sounds'}
          className={cn('grid h-7 w-7 place-items-center rounded-lg border transition-colors',
            timer.soundEnabled ? 'border-brand/40 bg-brand-soft text-brand-text' : 'border-line text-ink-3')}
        >
          {timer.soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
      </div>
      {phase.round && phase.totalRounds && (
        <p className="mt-1.5 text-sm text-ink-3 tabular">Set {phase.round} of {phase.totalRounds}</p>
      )}

      <div className="mt-4">
        <ProgressRing
          value={pct} size={200} stroke={11}
          tone={resting ? 'info' : 'brand'}
          label={`${seconds} seconds remaining`}
        >
          <span className="text-4xl font-black tabular leading-none">{formatDuration(seconds)}</span>
          <span className="mt-1.5 text-2xs uppercase tracking-wide text-ink-3">
            {timer.running ? 'remaining' : 'paused'}
          </span>
        </ProgressRing>
      </div>

      {!resting && step.cues.length > 0 && (
        <ol className="mt-4 w-full max-w-md space-y-1.5">
          {step.cues.slice(0, 3).map((cue, i) => (
            <li key={cue} className="flex gap-2 text-xs text-ink-2 leading-relaxed">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-soft text-2xs font-bold text-brand-text">
                {i + 1}
              </span>
              {cue}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex items-center gap-2.5">
        <Button variant="outline" onClick={() => timer.adjust(-15)} icon={<Minus size={15} />}>15s</Button>
        <Button className="w-28" onClick={() => (timer.running ? timer.pause() : timer.resume())}
          icon={timer.running ? <Pause size={17} /> : <Play size={17} />}>
          {timer.running ? 'Pause' : 'Resume'}
        </Button>
        <Button variant="outline" onClick={() => timer.adjust(15)} icon={<Plus size={15} />}>15s</Button>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => timer.skipPhase()} icon={<SkipForward size={14} />}>Skip</Button>
        <Button variant="ghost" size="sm" onClick={onStop} icon={<RotateCcw size={14} />}>Stop</Button>
      </div>

      <ol className="mt-5 flex w-full gap-1 overflow-x-auto no-scrollbar" aria-label="Session phases">
        {timer.plan.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              'h-1.5 shrink-0 rounded-full transition-colors',
              p.kind === 'rest' ? 'w-3' : 'w-7',
              i < timer.phaseIndex ? 'bg-brand' : i === timer.phaseIndex ? 'bg-brand animate-pulse' : 'bg-surface-3',
            )}
          />
        ))}
      </ol>
    </div>
  );
}

function StepRow({ step, index, current }: { step: PracticeStep; index: number; current: boolean }) {
  const [open, setOpen] = useState(false);
  const isExercise = step.kind === 'exercise';

  return (
    <li className={cn('p-4 sm:p-5 transition-colors', current && 'bg-brand-soft/30')}>
      <div className="flex items-start gap-3">
        <span className={cn(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black tabular',
          isExercise ? 'bg-brand-soft text-brand-text' : 'bg-surface-2 text-ink-3',
        )}>
          {isExercise ? index : <TimerIcon size={13} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{step.name}</h3>
            {current && <Badge tone="brand" size="sm">Now</Badge>}
            {step.slug && (
              <Link to={`/exercises/${step.slug}`} className="text-2xs font-semibold text-brand-text hover:underline">
                Full guide
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink-3">{step.detail}</p>

          {step.cues.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="mt-2 text-xs font-semibold text-brand-text hover:underline"
              >
                {open ? 'Hide the steps' : `Show the ${step.cues.length} steps`}
              </button>

              {open && (
                <>
                  <ol className="mt-2 space-y-1.5">
                    {step.cues.map((cue, i) => (
                      <li key={cue} className="flex gap-2.5 text-sm text-ink-2 leading-relaxed">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-2xs font-bold tabular">
                          {i + 1}
                        </span>
                        {cue}
                      </li>
                    ))}
                  </ol>
                  {step.mistakes.length > 0 && (
                    <div className="mt-3 rounded-xl border border-warn/30 bg-warn-soft/40 p-3">
                      <p className="text-2xs font-bold uppercase tracking-wider text-warn">Common mistakes</p>
                      <ul className="mt-1 space-y-1">
                        {step.mistakes.map((m) => (
                          <li key={m} className="flex gap-2 text-xs text-ink-2 leading-relaxed">
                            <Check size={12} className="mt-0.5 shrink-0 rotate-45 text-warn" aria-hidden /> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
