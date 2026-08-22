import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BatteryCharging, CalendarDays, ChevronRight, Dumbbell, Flame,
  Moon, Play, Sparkles, Target, Trophy, ClipboardCheck, Info, Plus, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { StatTile } from '@/components/dashboard/StatTile';
import { MuscleMap } from '@/components/MuscleMap';
import { EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/store/auth';
import { selectActiveSession, useData } from '@/store/data';
import {
  useFitScore, useFitScoreDelta, useNextSession, useStreak, useTodaysProgramDay,
  useTodaysRecovery, useWeekProgress, completedSessionsSorted,
} from '@/lib/selectors';
import { getExercise, MUSCLE_LABEL } from '@/data/exercises';
import { activeNiggles, computeMuscleFreshness } from '@/lib/fitness/freshness';
import { useHasFeature } from '@/lib/selectors';
import { fitScoreBand } from '@/lib/fitness/fitscore';
import { GOAL_STATUS_META, goalPercent } from '@/lib/fitness/goals';
import { SESSION_KIND_META } from '@/lib/fitness/program';
import { fmtWeight } from '@/lib/fitness/units';
import { DAY_SHORT, greeting, relativeDay, today } from '@/lib/date';
import { cn, humanDuration, pluralize } from '@/lib/utils';
import type { MuscleGroup } from '@/types';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const programDay = useTodaysProgramDay();
  const program = useData((s) => s.programs.find((p) => p.active) ?? null);
  const sessions = useData((s) => s.sessions);
  const goals = useData((s) => s.goals);
  const records = useData((s) => s.records);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const activeSession = useData(selectActiveSession);
  const assessments = useData((s) => s.assessments);
  const sets = useData((s) => s.sets);
  const niggles = useData((s) => s.niggles);

  const recovery = useTodaysRecovery();
  const streak = useStreak();
  const fitScore = useFitScore();
  const delta = useFitScoreDelta();
  const week = useWeekProgress();
  const next = useNextSession();

  const todaysSession = sessions.find((s) => s.date === today() && s.status === 'completed');
  const primaryGoal = goals.filter((g) => !g.archived).sort((a, b) => goalPercent(b) - goalPercent(a))[0] ?? null;
  const recentRecord = [...records].sort((a, b) => b.achieved_at.localeCompare(a.achieved_at))[0] ?? null;
  const lastSessions = useMemo(() => completedSessionsSorted(sessions).slice(0, 4), [sessions]);

  const hasBodyMap = useHasFeature('body_map');
  const body = useMemo(() => {
    if (!hasBodyMap) return null;
    const freshness = computeMuscleFreshness(sets, sessions);
    const notFresh = freshness.filter((f) => f.status !== 'fresh');
    return {
      heat: Object.fromEntries(freshness.map((f) => [f.muscle, f.freshness])) as Partial<Record<MuscleGroup, number>>,
      recoveringCount: notFresh.length,
      worst: notFresh.sort((a, b) => a.freshness - b.freshness)[0] ?? null,
      niggleCount: activeNiggles(niggles).length,
      niggledMuscles: activeNiggles(niggles).map((n) => n.muscle),
    };
  }, [hasBodyMap, sets, sessions, niggles]);

  const todaysMuscles = useMemo(() => {
    const primary = new Set<MuscleGroup>();
    const secondary = new Set<MuscleGroup>();
    for (const pe of programDay?.exercises ?? []) {
      const e = getExercise(pe.exercise_slug);
      e?.primary.forEach((m) => primary.add(m));
      e?.secondary.forEach((m) => secondary.add(m));
    }
    return { primary: [...primary], secondary: [...secondary].filter((m) => !primary.has(m)) };
  }, [programDay]);

  const firstName = profile?.full_name.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      {/* Greeting (mobile — desktop shows it in the top bar) */}
      <header className="lg:hidden">
        <p className="text-sm text-ink-3">{greeting()}, {firstName}.</p>
        <h1 className="text-2xl font-black tracking-tight">Ready to get stronger?</h1>
      </header>

      {/* ---------- Hero: today's workout ---------- */}
      {activeSession ? (
        <Card className="border-brand/40 bg-brand-soft/30">
          <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <Badge tone="brand" icon={<span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />}>In progress</Badge>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{activeSession.title}</h2>
              <p className="text-sm text-ink-3 mt-1">Pick up exactly where you left off.</p>
            </div>
            <Button size="xl" to="/workout/live" icon={<Play size={18} />}>Resume workout</Button>
          </div>
        </Card>
      ) : todaysSession ? (
        <Card className="border-success/40">
          <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
            <span className="h-12 w-12 rounded-2xl bg-success-soft grid place-items-center text-success shrink-0">
              <CheckCircle2 size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{todaysSession.title} complete</h2>
              <p className="text-sm text-ink-3 mt-0.5">
                {humanDuration(todaysSession.duration_seconds)} · logged {relativeDay(todaysSession.date).toLowerCase()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" to="/progress">View progress</Button>
              <Button variant="outline" to="/workout">Train again</Button>
            </div>
          </div>
        </Card>
      ) : !program ? (
        <Card>
          <EmptyState
            icon={<Dumbbell size={22} />}
            title="You do not have an active programme yet"
            body="Build one from your goal, schedule and equipment — it takes a few seconds."
            action={<Button to="/program" icon={<Plus size={16} />}>Create my programme</Button>}
          />
        </Card>
      ) : programDay && programDay.kind !== 'rest' ? (
        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[1fr,auto]">
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Badge tone="brand" icon={<Icon name={SESSION_KIND_META[programDay.kind].icon} size={12} />}>
                  Today's workout
                </Badge>
                <span className="text-2xs text-ink-3 tabular">{DAY_SHORT[programDay.weekday]}</span>
              </div>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tighter uppercase">{programDay.title}</h2>
              <p className="text-sm text-ink-2 mt-1">{programDay.focus}</p>
              <p className="text-sm text-ink-3 mt-1 tabular">
                Estimated duration: {programDay.est_minutes} min · {pluralize(programDay.exercises.length, 'exercise')}
              </p>

              <ol className="mt-4 space-y-1.5">
                {programDay.exercises.slice(0, 6).map((pe, i) => {
                  const e = getExercise(pe.exercise_slug);
                  return (
                    <li key={pe.id} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-2xs font-bold text-ink-3 tabular">{i + 1}</span>
                      <span className="flex-1 truncate">{e?.name ?? pe.exercise_slug}</span>
                      <span className="text-2xs text-ink-3 tabular shrink-0">
                        {pe.target_seconds ? `${Math.round(pe.target_seconds / 60)} min` : `${pe.sets} × ${pe.target_reps}`}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="xl" onClick={() => navigate('/workout')} icon={<Play size={18} />}>START WORKOUT</Button>
                <Button size="xl" variant="outline" to="/program">Adjust</Button>
              </div>

              {recovery.hasInput && recovery.score < 45 && (
                <p className="mt-4 flex items-start gap-2 text-xs text-warn leading-relaxed">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>Your recovery check-in is low today. {recovery.advice}</span>
                </p>
              )}
            </div>

            <div className="hidden sm:flex items-center justify-center px-6 border-l border-line bg-surface-2/50">
              <div className="text-center">
                <MuscleMap primary={todaysMuscles.primary} secondary={todaysMuscles.secondary} view="both" size={78} showLabels />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-success/30">
          <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4">
            <span className="h-12 w-12 rounded-2xl bg-success-soft grid place-items-center text-success shrink-0">
              <Moon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">Rest day</h2>
              <p className="text-sm text-ink-3 mt-0.5 leading-relaxed">
                This is part of your plan, not a gap in it. Your streak stays intact.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" to="/recovery" icon={<BatteryCharging size={16} />}>Recovery check-in</Button>
              <Button variant="outline" to="/workout">Train anyway</Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---------- Stat row ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="This week" value={week.completed} unit={`/ ${week.target}`}
          hint={week.completed >= week.target ? 'Target met' : `${week.target - week.completed} to go`}
          icon={<CalendarDays size={15} />} to="/calendar"
        >
          <ProgressBar value={week.completed} max={week.target} className="mt-3" height="sm" />
        </StatTile>

        <StatTile
          label="Streak" value={streak.current} unit="days" tone="brand"
          hint={streak.longest > streak.current ? `Best ${streak.longest}` : 'Personal best'}
          icon={<Flame size={15} />} to="/achievements"
        />

        <StatTile
          label="FitScore" value={fitScore.total} trend={delta}
          hint={fitScoreBand(fitScore.total).label}
          icon={<Sparkles size={15} />} to="/progress"
        />

        <StatTile
          label="Recovery"
          value={recovery.hasInput ? recovery.score : '—'}
          unit={recovery.hasInput ? '/ 100' : undefined}
          hint={recovery.hasInput ? recovery.label : 'No check-in yet'}
          icon={<BatteryCharging size={15} />} to="/recovery"
        />
      </div>

      {/* ---------- Two-column body ---------- */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Goal progress */}
          <Card>
            <CardHeader
              title="Goal progress"
              subtitle={primaryGoal ? primaryGoal.title : 'No goals set yet'}
              action={<Button variant="ghost" size="sm" to="/goals" iconRight={<ChevronRight size={14} />}>All goals</Button>}
            />
            <div className="p-5 pt-4">
              {primaryGoal ? (
                <div className="flex items-center gap-5">
                  <ProgressRing value={goalPercent(primaryGoal)} size={104} stroke={9} label={`${primaryGoal.title}, ${goalPercent(primaryGoal)} percent`}>
                    <span className="text-2xl font-black tabular leading-none">{goalPercent(primaryGoal)}%</span>
                  </ProgressRing>
                  <div className="min-w-0 flex-1">
                    <Badge tone={GOAL_STATUS_META[primaryGoal.status].tone}>
                      <Icon name={GOAL_STATUS_META[primaryGoal.status].icon} size={11} />
                      {GOAL_STATUS_META[primaryGoal.status].label}
                    </Badge>
                    <p className="mt-2.5 text-sm text-ink-2">
                      <span className="tabular font-semibold text-ink">{primaryGoal.current_value}</span>
                      <span className="text-ink-3"> of </span>
                      <span className="tabular font-semibold text-ink">{primaryGoal.target_value}</span>
                      <span className="text-ink-3"> {primaryGoal.unit}</span>
                    </p>
                    <p className="mt-1 text-2xs text-ink-3">
                      Started at {primaryGoal.start_value} {primaryGoal.unit} · target {relativeDay(primaryGoal.target_date)}
                    </p>
                    {goals.filter((g) => !g.archived).length > 1 && (
                      <p className="mt-2 text-2xs text-ink-3">
                        +{goals.filter((g) => !g.archived).length - 1} more goal(s) tracking
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Target size={20} />}
                  title="Set your first goal"
                  body="Goals update automatically from what you log — weight, strength, distance or consistency."
                  action={<Button size="sm" to="/goals" icon={<Plus size={14} />}>Create a goal</Button>}
                />
              )}
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader
              title="Recent workouts"
              action={<Button variant="ghost" size="sm" to="/progress" iconRight={<ChevronRight size={14} />}>History</Button>}
            />
            {lastSessions.length === 0 ? (
              <EmptyState
                compact
                icon={<Dumbbell size={20} />}
                title="Nothing logged yet"
                body="Your first session will appear here with duration, volume and how it felt."
              />
            ) : (
              <ul className="divide-y divide-line">
                {lastSessions.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-center gap-3 px-5 py-3">
                      <span className={cn('h-9 w-9 rounded-xl grid place-items-center shrink-0 bg-surface-2 text-ink-2')}>
                        <Icon name={SESSION_KIND_META[s.kind].icon} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{s.title}</p>
                        <p className="text-2xs text-ink-3 tabular">
                          {relativeDay(s.date)} · {humanDuration(s.duration_seconds)}
                          {s.difficulty ? ` · difficulty ${s.difficulty}/5` : ''}
                        </p>
                      </div>
                      {s.feeling && <Badge tone="muted" size="sm">{s.feeling}</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {!profile?.assessment_done && assessments.length === 0 && (
            <Card className="border-accent/30">
              <div className="p-5">
                <span className="h-10 w-10 rounded-xl bg-accent-soft grid place-items-center text-accent-text">
                  <ClipboardCheck size={19} />
                </span>
                <h3 className="mt-3 font-semibold">Set your baseline</h3>
                <p className="mt-1.5 text-sm text-ink-3 leading-relaxed">
                  A few optional numbers now give every future chart something honest to compare against.
                </p>
                <Button size="sm" className="mt-4" to="/assessment" iconRight={<ArrowRight size={14} />}>
                  Take FitStart
                </Button>
              </div>
            </Card>
          )}

          {/* Upcoming */}
          <Card>
            <CardHeader title="Coming up" dense />
            <div className="px-4 pb-4 pt-3">
              {next ? (
                <Link to="/program" className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors">
                  <span className="h-9 w-9 rounded-xl bg-surface-2 grid place-items-center text-ink-2 shrink-0">
                    <Icon name={SESSION_KIND_META[next.day.kind].icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{next.day.title}</p>
                    <p className="text-2xs text-ink-3">{relativeDay(next.date)}{next.day.est_minutes ? ` · ${next.day.est_minutes} min` : ''}</p>
                  </div>
                  <ChevronRight size={15} className="text-ink-3 shrink-0" />
                </Link>
              ) : (
                <p className="text-sm text-ink-3 px-3 py-2">No programme scheduled.</p>
              )}
            </div>
          </Card>

          {/* Body Map */}
          <Card>
            <CardHeader
              title="Body Map" dense
              action={body
                ? <Link to="/body" className="text-xs text-brand-text font-medium hover:underline">Open</Link>
                : <Badge tone="accent" size="sm">Plus</Badge>}
            />
            {body ? (
              <Link to="/body" className="flex items-center gap-4 px-5 pb-4 pt-1 hover:bg-surface-2 transition-colors rounded-b-2xl">
                <MuscleMap view="front" size={52} heat={body.heat} markers={body.niggledMuscles} className="shrink-0" />
                <div className="min-w-0 text-sm text-ink-2 leading-relaxed">
                  {body.recoveringCount === 0 ? (
                    <p>Everything reads fresh — a good day to train hard.</p>
                  ) : (
                    <p>
                      <span className="font-semibold text-ink">{pluralize(body.recoveringCount, 'muscle group')}</span>
                      {' '}still recovering
                      {body.worst ? <> — {MUSCLE_LABEL[body.worst.muscle].toLowerCase()} most of all</> : null}.
                    </p>
                  )}
                  {body.niggleCount > 0 && (
                    <p className="mt-1 text-2xs text-danger font-medium">
                      {pluralize(body.niggleCount, 'active niggle')} on watch
                    </p>
                  )}
                </div>
              </Link>
            ) : (
              <Link to="/pricing" className="flex items-center gap-4 px-5 pb-4 pt-1 hover:bg-surface-2 transition-colors rounded-b-2xl">
                <MuscleMap view="front" size={52} primary={['chest', 'quads']} secondary={['shoulders', 'core']} className="shrink-0 opacity-60" />
                <p className="min-w-0 text-sm text-ink-2 leading-relaxed">
                  See which muscles are fresh, recovering or fatigued — computed from your own sets.
                  <span className="block mt-0.5 text-2xs text-brand-text font-semibold">Included in Plus →</span>
                </p>
              </Link>
            )}
          </Card>

          {/* Latest record */}
          {recentRecord && (
            <Card>
              <CardHeader title="Latest record" dense />
              <div className="px-5 pb-5 pt-2">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-warn-soft grid place-items-center text-warn shrink-0">
                    <Trophy size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{getExercise(recentRecord.exercise_slug)?.name}</p>
                    <p className="text-2xs text-ink-3 tabular">
                      {recentRecord.unit === 'kg' ? fmtWeight(recentRecord.value, units) : `${recentRecord.value} ${recentRecord.unit}`}
                      {recentRecord.previous_value ? ` · up from ${recentRecord.previous_value}` : ''}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="mt-3" to="/records" iconRight={<ChevronRight size={14} />}>
                  All records
                </Button>
              </div>
            </Card>
          )}

          {/* Habits */}
          {habits.filter((h) => h.active).length > 0 && (
            <Card>
              <CardHeader title="Today's habits" dense action={<Link to="/habits" className="text-xs text-brand-text font-medium hover:underline">Log</Link>} />
              <ul className="px-5 pb-5 pt-3 space-y-3">
                {habits.filter((h) => h.active).slice(0, 4).map((h) => {
                  const log = habitLogs.find((l) => l.habit_id === h.id && l.date === today());
                  const value = log?.value ?? 0;
                  return (
                    <li key={h.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5 text-ink-2">
                          <Icon name={h.icon} size={13} style={{ color: h.color }} />
                          {h.name}
                        </span>
                        <span className="tabular text-ink-3">{value} / {h.target}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${Math.min(100, (value / h.target) * 100)}%`, backgroundColor: h.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
