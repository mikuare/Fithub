import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Sparkles, Info, Plus, Trash2, Play, Pencil, Check, X, Wand2, Moon,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { CategoryBars } from '@/components/charts/Charts';
import { ExercisePickerModal } from '@/components/workout/ExercisePickerModal';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import {
  generateProgram, estimateSessionMinutes, SESSION_KIND_META, weeklyVolumeByMuscle, GOAL_LABEL,
} from '@/lib/fitness/program';
import { weeklySetTarget, repScheme } from '@/lib/fitness/calculations';
import { getExercise, MUSCLE_LABEL } from '@/data/exercises';
import { uid } from '@/lib/id';
import { DAY_NAMES, DAY_SHORT, today, weekdayOf } from '@/lib/date';
import { cn, titleCase } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { Program as ProgramType, ProgramDay, SessionKind, Exercise, MuscleGroup } from '@/types';

export default function Program() {
  const { profile } = useAuth();
  const programs = useData((s) => s.programs);
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);

  const program = programs.find((p) => p.active) ?? null;
  const [editingDay, setEditingDay] = useState<ProgramDay | null>(null);
  const [pickerFor, setPickerFor] = useState<ProgramDay | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [busy, setBusy] = useState(false);

  const volume = useMemo(() => weeklyVolumeByMuscle(program), [program]);
  const target = weeklySetTarget(fitnessProfile?.experience ?? 'beginner');

  const volumeData = useMemo(
    () =>
      Object.entries(volume)
        .filter(([m]) => m !== 'cardio' && m !== 'full_body')
        .map(([muscle, sets]) => ({
          label: MUSCLE_LABEL[muscle as MuscleGroup] ?? titleCase(muscle),
          value: Math.round(sets * 10) / 10,
          color: sets < target.min ? '#F5BE3E' : sets > target.max ? '#F87171' : '#B9F227',
        }))
        .sort((a, b) => b.value - a.value),
    [volume, target],
  );

  const regenerate = async () => {
    if (!fitnessProfile || !profile) return;
    setBusy(true);
    try {
      const next = generateProgram(fitnessProfile, profile.id, { seed: Date.now() % 1_000_000 });
      if (program) await put('programs', { ...program, active: false });
      await put('programs', next);
      toast.success('New programme generated', `${next.split} — ${next.days_per_week} days a week.`);
    } finally {
      setBusy(false);
      setConfirmRegen(false);
    }
  };

  const saveDay = async (day: ProgramDay) => {
    if (!program) return;
    const updated: ProgramType = {
      ...program,
      days: program.days.map((d) => (d.id === day.id ? { ...day, est_minutes: estimateSessionMinutes(day.exercises) } : d)),
    };
    await put('programs', updated);
    setEditingDay(null);
    toast.success('Day updated', day.title);
  };

  const addExerciseToDay = async (day: ProgramDay, exercise: Exercise) => {
    if (!program || !fitnessProfile) return;
    const scheme = repScheme(fitnessProfile.primary_goal, fitnessProfile.experience, exercise.mechanic);
    const isCardio = exercise.type === 'cardio';
    const isTimed = exercise.type === 'timed' || exercise.type === 'mobility';
    const nextDay: ProgramDay = {
      ...day,
      kind: day.kind === 'rest' ? 'custom' : day.kind,
      title: day.kind === 'rest' ? 'Custom session' : day.title,
      exercises: [
        ...day.exercises,
        {
          id: uid('pe'),
          exercise_slug: exercise.slug,
          order: day.exercises.length,
          sets: isCardio ? 1 : scheme.sets,
          target_reps: isCardio || isTimed ? null : scheme.reps,
          target_seconds: isCardio ? 1200 : isTimed ? 40 : null,
          target_weight_kg: null,
          rest_seconds: isCardio ? 0 : scheme.restSeconds,
          notes: '',
          superset_group: null,
        },
      ],
    };
    await saveDay(nextDay);
    setEditingDay(nextDay);
  };

  if (!program) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="My Program" subtitle="Your weekly training structure." />
        <Card>
          <EmptyState
            icon={<Wand2 size={22} />}
            title="No active programme"
            body="FitHub can build one from your goal, experience, equipment and schedule — then you can adjust anything by hand."
            action={
              <Button onClick={() => void regenerate()} loading={busy} icon={<Sparkles size={16} />}>
                Generate my programme
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const todaysWeekday = weekdayOf(today());

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="My Program"
        title={program.name}
        subtitle={program.notes}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)} icon={<RefreshCw size={14} />}>
              Regenerate
            </Button>
            <Button size="sm" to="/workout" icon={<Play size={14} />}>Start today</Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-[1fr,300px] gap-4">
        {/* Week */}
        <div className="space-y-2.5">
          {program.days.map((day) => {
            const isToday = day.weekday === todaysWeekday;
            const meta = SESSION_KIND_META[day.kind];
            return (
              <Card key={day.id} className={cn(isToday && 'border-brand/50 shadow-glow')}>
                <div className="flex items-start gap-3 p-4">
                  <div className="w-12 shrink-0 text-center">
                    <p className={cn('text-2xs font-bold uppercase tracking-wider', isToday ? 'text-brand-text' : 'text-ink-3')}>
                      {DAY_SHORT[day.weekday]}
                    </p>
                    <div className={cn(
                      'mt-1.5 h-9 w-9 mx-auto rounded-xl grid place-items-center',
                      day.kind === 'rest' ? 'bg-surface-2 text-ink-3' : 'bg-brand-soft text-brand-text',
                    )}>
                      <Icon name={meta.icon} size={16} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={cn('font-bold', day.kind === 'rest' && 'text-ink-3')}>{day.title}</h3>
                      {isToday && <Badge tone="brand" size="sm">Today</Badge>}
                      {day.est_minutes > 0 && <span className="text-2xs text-ink-3 tabular">{day.est_minutes} min</span>}
                    </div>
                    <p className="text-sm text-ink-3 mt-0.5">{day.focus}</p>

                    {day.exercises.length > 0 && (
                      <ol className="mt-3 space-y-1">
                        {day.exercises.map((pe, i) => {
                          const e = getExercise(pe.exercise_slug);
                          return (
                            <li key={pe.id} className="flex items-center gap-2.5 text-sm">
                              <span className="w-4 text-2xs text-ink-3 tabular">{i + 1}</span>
                              <Link to={`/exercises/${pe.exercise_slug}`} className="flex-1 truncate hover:text-brand-text hover:underline">
                                {e?.name ?? pe.exercise_slug}
                              </Link>
                              <span className="text-2xs text-ink-3 tabular shrink-0">
                                {pe.target_seconds
                                  ? `${pe.sets} × ${pe.target_seconds >= 60 ? `${Math.round(pe.target_seconds / 60)}m` : `${pe.target_seconds}s`}`
                                  : `${pe.sets} × ${pe.target_reps}`}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    {day.kind === 'rest' && (
                      <p className="mt-2 flex items-center gap-2 text-2xs text-ink-3">
                        <Moon size={12} /> Rest days keep your consistency streak intact.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingDay(day)}
                      aria-label={`Edit ${DAY_NAMES[day.weekday]}`}
                      className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerFor(day)}
                      aria-label={`Add exercise to ${DAY_NAMES[day.weekday]}`}
                      className="h-8 w-8 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <Card>
            <CardHeader title="Programme details" dense />
            <dl className="p-4 pt-2 space-y-2 text-sm">
              {[
                ['Split', program.split],
                ['Goal', GOAL_LABEL[program.goal]],
                ['Level', titleCase(program.experience)],
                ['Days per week', String(program.days_per_week)],
                ['Built', program.generated ? 'By FitHub' : 'By hand'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Weekly volume"
              subtitle={`Target ${target.min}–${target.max} hard sets per muscle`}
              dense
            />
            <div className="p-3 pt-1">
              {volumeData.length ? (
                <CategoryBars data={volumeData} height={Math.max(200, volumeData.length * 24)} unit=" sets" />
              ) : (
                <p className="text-xs text-ink-3 text-center py-6">No resistance work scheduled.</p>
              )}
            </div>
            <div className="px-4 pb-4">
              <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                <Info size={12} className="shrink-0 mt-0.5" />
                <span>
                  Amber means below the useful range for your level; red means above it. Secondary
                  involvement counts as half a set.
                </span>
              </p>
            </div>
          </Card>

          {programs.filter((p) => !p.active).length > 0 && (
            <Card>
              <CardHeader title="Previous programmes" dense />
              <ul className="p-3 pt-1 space-y-1">
                {programs.filter((p) => !p.active).slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2">
                    <span className="min-w-0 flex-1 text-xs truncate">{p.name}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (program) await put('programs', { ...program, active: false });
                        await put('programs', { ...p, active: true });
                        toast.success('Programme activated', p.name);
                      }}
                      className="text-2xs font-semibold text-brand-text hover:underline shrink-0"
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      onClick={() => void del('programs', p.id)}
                      aria-label={`Delete ${p.name}`}
                      className="h-6 w-6 grid place-items-center rounded text-ink-3 hover:text-danger shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {editingDay && (
        <DayEditor
          day={editingDay}
          onClose={() => setEditingDay(null)}
          onSave={saveDay}
          onAddExercise={() => { setPickerFor(editingDay); }}
        />
      )}

      <ExercisePickerModal
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(e) => pickerFor && void addExerciseToDay(pickerFor, e)}
        title={pickerFor ? `Add to ${pickerFor.title}` : 'Add exercise'}
        excludeSlugs={pickerFor?.exercises.map((x) => x.exercise_slug) ?? []}
      />

      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={() => void regenerate()}
        title="Generate a new programme?"
        body="Your current programme is kept in history and can be reactivated. Logged workouts are never affected."
        confirmLabel="Generate"
        tone="primary"
        busy={busy}
      />
    </div>
  );
}

function DayEditor({
  day, onClose, onSave, onAddExercise,
}: {
  day: ProgramDay;
  onClose: () => void;
  onSave: (day: ProgramDay) => void | Promise<void>;
  onAddExercise: () => void;
}) {
  const [draft, setDraft] = useState<ProgramDay>(day);

  const update = (id: string, patch: Partial<ProgramDay['exercises'][number]>) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const remove = (id: string) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== id).map((x, i) => ({ ...x, order: i })) }));

  return (
    <Modal
      open
      onClose={onClose}
      title={`${DAY_NAMES[draft.weekday]} — ${draft.title}`}
      description={`About ${estimateSessionMinutes(draft.exercises)} minutes`}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} icon={<X size={15} />}>Cancel</Button>
          <span className="flex-1" />
          <Button onClick={() => void onSave(draft)} icon={<Check size={15} />}>Save day</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Day title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Select
            label="Type"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as SessionKind })}
            options={(Object.keys(SESSION_KIND_META) as SessionKind[]).map((k) => ({ value: k, label: SESSION_KIND_META[k].label }))}
          />
        </div>
        <Input label="Focus" value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value })} />

        {draft.exercises.length === 0 ? (
          <p className="text-sm text-ink-3 py-6 text-center">
            No exercises on this day. {draft.kind === 'rest' ? 'That is intentional — rest is part of the plan.' : ''}
          </p>
        ) : (
          <ul className="space-y-2">
            {draft.exercises.map((pe, i) => {
              const e = getExercise(pe.exercise_slug);
              return (
                <li key={pe.id} className="p-3 rounded-xl border border-line">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-2xs font-bold text-ink-3 tabular">{i + 1}</span>
                    <span className="flex-1 font-medium text-sm truncate">{e?.name}</span>
                    <button
                      type="button" onClick={() => remove(pe.id)} aria-label={`Remove ${e?.name}`}
                      className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Input
                      label="Sets" type="number" min={1} value={pe.sets}
                      onChange={(ev) => update(pe.id, { sets: Math.max(1, Number(ev.target.value) || 1) })}
                    />
                    {pe.target_seconds === null ? (
                      <Input
                        label="Reps" type="number" min={1} value={pe.target_reps ?? ''}
                        onChange={(ev) => update(pe.id, { target_reps: Number(ev.target.value) || null })}
                      />
                    ) : (
                      <Input
                        label="Seconds" type="number" min={5} value={pe.target_seconds}
                        onChange={(ev) => update(pe.id, { target_seconds: Number(ev.target.value) || 30 })}
                      />
                    )}
                    <Input
                      label="Rest (s)" type="number" min={0} step={15} value={pe.rest_seconds}
                      onChange={(ev) => update(pe.id, { rest_seconds: Math.max(0, Number(ev.target.value) || 0) })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Button variant="outline" block onClick={onAddExercise} icon={<Plus size={15} />}>Add exercise</Button>
      </div>
    </Modal>
  );
}
