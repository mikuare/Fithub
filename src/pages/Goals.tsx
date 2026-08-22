import { useMemo, useState } from 'react';
import { Plus, Target, Trash2, Archive, Pencil, TrendingUp, Flag, CheckCircle2, Info } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Label } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { useTier } from '@/lib/selectors';
import { goalLimit } from '@/lib/billing/plans';
import {
  GOAL_METRIC_META, GOAL_STATUS_META, buildMilestones, goalPercent,
  projectedDate, requiredWeeklyRate,
} from '@/lib/fitness/goals';
import { EXERCISES } from '@/data/exercises';
import { uid } from '@/lib/id';
import { addDays, formatDate, nowISO, relativeDay, today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { Goal, GoalMetric } from '@/types';

export default function Goals() {
  const { profile } = useAuth();
  const goals = useData((s) => s.goals);
  const habits = useData((s) => s.habits);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);
  const recalc = useData((s) => s.recalcGoals);

  const [tab, setTab] = useState<'active' | 'achieved' | 'archived'>('active');
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const filtered = useMemo(() => {
    const list = goals.filter((g) =>
      tab === 'archived' ? g.archived : tab === 'achieved' ? !g.archived && g.status === 'achieved' : !g.archived && g.status !== 'achieved',
    );
    return list.sort((a, b) => goalPercent(b) - goalPercent(a));
  }, [goals, tab]);

  const counts = {
    active: goals.filter((g) => !g.archived && g.status !== 'achieved').length,
    achieved: goals.filter((g) => !g.archived && g.status === 'achieved').length,
    archived: goals.filter((g) => g.archived).length,
  };

  const tier = useTier();
  const limit = goalLimit(tier);
  const atLimit = limit !== null && counts.active >= limit;

  const tryCreate = () => {
    if (atLimit) {
      toast.warn(`Free plan includes ${limit} active goals`, 'Archive one, or upgrade to Plus for unlimited goals.');
      return;
    }
    setCreating(true);
  };

  const save = async (goal: Goal) => {
    await put('goals', goal);
    await recalc();
    setEditing(null);
    setCreating(false);
    toast.success('Goal saved', goal.title);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="My Goals"
        title="What you're working toward"
        subtitle="Goals update themselves from what you log — weight, strength, distance, consistency or habits."
        actions={<Button onClick={tryCreate} icon={<Plus size={15} />}>New goal</Button>}
      />

      {atLimit && (
        <Card className="border-accent/30">
          <div className="px-5 py-3.5 flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-52 text-sm text-ink-2">
              You're at the Free plan's <span className="font-semibold">{limit} active goal</span> limit.
              Archive a goal to make room, or go unlimited with Plus.
            </p>
            <Button to="/pricing" variant="outline" size="sm">See plans</Button>
          </div>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'active', label: 'Active', count: counts.active },
          { key: 'achieved', label: 'Achieved', count: counts.achieved },
          { key: 'archived', label: 'Archived', count: counts.archived },
        ]}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={22} />}
            title={tab === 'active' ? 'No active goals' : tab === 'achieved' ? 'Nothing achieved yet' : 'Nothing archived'}
            body={
              tab === 'active'
                ? 'A measurable goal with a date is the difference between "I want to get fitter" and a plan you can check.'
                : tab === 'achieved'
                  ? 'Achieved goals will collect here. They are worth looking back on.'
                  : 'Archived goals stay out of your way but are never deleted.'
            }
            action={tab === 'active' ? <Button onClick={tryCreate} icon={<Plus size={15} />}>Create a goal</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => setEditing(goal)}
              onArchive={async () => {
                await put('goals', { ...goal, archived: !goal.archived });
                toast.info(goal.archived ? 'Goal restored' : 'Goal archived');
              }}
              onDelete={() => setDeleting(goal)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && profile && (
        <GoalEditor
          goal={editing}
          userId={profile.id}
          habitOptions={habits.map((h) => ({ value: h.id, label: h.name }))}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={save}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await del('goals', deleting.id);
          setDeleting(null);
          toast.info('Goal deleted');
        }}
        title="Delete this goal?"
        body="This cannot be undone. If you just want it out of the way, archive it instead."
        confirmLabel="Delete"
      />
    </div>
  );
}

function GoalCard({ goal, onEdit, onArchive, onDelete }: {
  goal: Goal;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const pct = goalPercent(goal);
  const meta = GOAL_STATUS_META[goal.status];
  const rate = requiredWeeklyRate(goal);
  const projected = projectedDate(goal);
  const daysLeft = Math.max(0, Math.round((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000));

  return (
    <Card className={cn(goal.status === 'achieved' && 'border-success/40')}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <ProgressRing
            value={pct}
            size={78}
            stroke={7}
            tone={goal.status === 'achieved' ? 'success' : goal.status === 'needs_attention' ? 'warn' : 'brand'}
            label={`${goal.title}, ${pct} percent complete`}
          >
            <span className="text-lg font-black tabular leading-none">{pct}%</span>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-tight">{goal.title}</h3>
            <Badge tone={meta.tone} size="sm" className="mt-1.5">
              <Icon name={meta.icon} size={10} />{meta.label}
            </Badge>
            <p className="mt-2 text-sm tabular">
              <span className="font-semibold">{goal.current_value}</span>
              <span className="text-ink-3"> / {goal.target_value} {goal.unit}</span>
            </p>
            <p className="text-2xs text-ink-3 mt-0.5">
              Started at {goal.start_value} {goal.unit}
            </p>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <button type="button" onClick={onEdit} aria-label="Edit goal"
              className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2">
              <Pencil size={13} />
            </button>
            <button type="button" onClick={onArchive} aria-label={goal.archived ? 'Restore goal' : 'Archive goal'}
              className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2">
              <Archive size={13} />
            </button>
            <button type="button" onClick={onDelete} aria-label="Delete goal"
              className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-danger hover:bg-danger-soft">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Milestones */}
        {goal.milestones.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-2xs text-ink-3 mb-1.5">
              <span>Milestones</span>
              <span className="tabular">{goal.milestones.filter((m) => m.reached_at).length} of {goal.milestones.length}</span>
            </div>
            <div className="flex gap-1">
              {goal.milestones.map((m, i) => (
                <div
                  key={i}
                  title={m.label}
                  className={cn(
                    'flex-1 h-1.5 rounded-full',
                    m.reached_at ? 'bg-brand' : 'bg-surface-3',
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-2xs text-ink-3">
              Next: {goal.milestones.find((m) => !m.reached_at)?.label ?? 'All milestones reached'}
            </p>
          </div>
        )}

        <dl className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-y-1.5 text-2xs">
          <dt className="text-ink-3">Target date</dt>
          <dd className="text-right font-medium tabular">{formatDate(goal.target_date, 'medium')}</dd>
          <dt className="text-ink-3">Days remaining</dt>
          <dd className="text-right font-medium tabular">{daysLeft}</dd>
          {rate !== null && goal.status !== 'achieved' && (
            <>
              <dt className="text-ink-3">Needed per week</dt>
              <dd className="text-right font-medium tabular">{rate > 0 ? '+' : ''}{rate} {goal.unit}</dd>
            </>
          )}
          {projected && goal.status !== 'achieved' && (
            <>
              <dt className="text-ink-3">At current pace</dt>
              <dd className="text-right font-medium tabular">{relativeDay(projected)}</dd>
            </>
          )}
        </dl>

        {goal.status === 'achieved' && goal.achieved_at && (
          <p className="mt-3 flex items-center gap-2 text-sm text-success font-medium">
            <CheckCircle2 size={15} /> Achieved {relativeDay(goal.achieved_at.slice(0, 10)).toLowerCase()}
          </p>
        )}
      </div>
    </Card>
  );
}

function GoalEditor({ goal, userId, habitOptions, onClose, onSave }: {
  goal: Goal | null;
  userId: string;
  habitOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSave: (goal: Goal) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Goal>(() =>
    goal ?? {
      id: uid('goal'), user_id: userId, title: '', metric: 'workouts_per_week', ref: null,
      unit: 'sessions', start_value: 0, target_value: 4, current_value: 0, direction: 'increase',
      start_date: today(), target_date: addDays(today(), 84), status: 'starting',
      milestones: [], achieved_at: null, archived: false, created_at: nowISO(),
    },
  );

  const meta = GOAL_METRIC_META[draft.metric];
  const needsRef = draft.metric === 'lift_1rm' || draft.metric === 'habit_streak' || draft.metric === 'body_measurement';

  const onMetricChange = (metric: GoalMetric) => {
    const m = GOAL_METRIC_META[metric];
    setDraft((d) => ({
      ...d,
      metric,
      unit: m.unit,
      direction: m.direction,
      ref: null,
      title: d.title || m.label,
    }));
  };

  const valid = draft.title.trim().length > 1 && draft.target_value !== draft.start_value && (!needsRef || !!draft.ref);

  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      description="Goals with a number and a date are the ones that get met."
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => void onSave({
              ...draft,
              milestones: draft.milestones.length
                ? draft.milestones
                : buildMilestones(draft.start_value, draft.target_value, draft.unit),
            })}
          >
            {goal ? 'Save changes' : 'Create goal'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Select
          label="What are you tracking?"
          value={draft.metric}
          onChange={(e) => onMetricChange(e.target.value as GoalMetric)}
          options={(Object.keys(GOAL_METRIC_META) as GoalMetric[]).map((k) => ({ value: k, label: GOAL_METRIC_META[k].label }))}
          hint={meta.hint}
        />

        {draft.metric === 'lift_1rm' && (
          <Select
            label="Which exercise?"
            value={draft.ref ?? ''}
            onChange={(e) => setDraft({ ...draft, ref: e.target.value, title: `${EXERCISES.find((x) => x.slug === e.target.value)?.name ?? ''} strength` })}
            options={[
              { value: '', label: 'Select an exercise…' },
              ...EXERCISES.filter((e) => e.type === 'strength').map((e) => ({ value: e.slug, label: e.name })),
            ]}
          />
        )}

        {draft.metric === 'habit_streak' && (
          <Select
            label="Which habit?"
            value={draft.ref ?? ''}
            onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
            options={[{ value: '', label: 'Select a habit…' }, ...habitOptions]}
            hint={habitOptions.length === 0 ? 'You have no habits yet — add one from Healthy Habits first.' : undefined}
          />
        )}

        {draft.metric === 'body_measurement' && (
          <Select
            label="Which measurement?"
            value={draft.ref ?? ''}
            onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
            options={[
              { value: '', label: 'Select…' },
              { value: 'waist_cm', label: 'Waist' }, { value: 'chest_cm', label: 'Chest' },
              { value: 'arm_cm', label: 'Upper arm' }, { value: 'thigh_cm', label: 'Thigh' },
              { value: 'hip_cm', label: 'Hips' },
            ]}
          />
        )}

        <Input label="Goal title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Bench press 70 kg" required />

        <div className="grid grid-cols-3 gap-3">
          <Input label="Starting" type="number" inputMode="decimal" step="0.1" value={draft.start_value}
            onChange={(e) => setDraft({ ...draft, start_value: Number(e.target.value) })} />
          <Input label="Target" type="number" inputMode="decimal" step="0.1" value={draft.target_value}
            onChange={(e) => setDraft({ ...draft, target_value: Number(e.target.value) })} />
          <Input label="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
          <Input label="Target date" type="date" value={draft.target_date} min={draft.start_date}
            onChange={(e) => setDraft({ ...draft, target_date: e.target.value })} />
        </div>

        <div>
          <Label>Direction</Label>
          <div className="grid grid-cols-2 gap-2">
            {([['increase', 'Increase', TrendingUp], ['decrease', 'Decrease', Flag]] as const).map(([value, label, Ico]) => (
              <button
                key={value}
                type="button"
                aria-pressed={draft.direction === value}
                onClick={() => setDraft({ ...draft, direction: value })}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  draft.direction === value ? 'bg-brand-soft border-brand/40 text-brand-text' : 'border-line text-ink-2',
                )}
              >
                <Ico size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        {draft.target_value !== draft.start_value && (
          <div>
            <p className="text-xs text-ink-3 mb-2">Milestones preview</p>
            <ProgressBar value={0} max={100} height="sm" />
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {buildMilestones(draft.start_value, draft.target_value, draft.unit).map((m, i) => (
                <li key={i} className="text-2xs px-2 py-1 rounded-lg bg-surface-2 border border-line tabular">{m.label}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
          <Info size={12} className="shrink-0 mt-0.5" />
          <span>
            {draft.metric === 'custom'
              ? 'Custom goals are updated by hand — edit the goal to record progress.'
              : 'This goal updates automatically as you log workouts, measurements or habits.'}
          </span>
        </p>
      </div>
    </Modal>
  );
}
