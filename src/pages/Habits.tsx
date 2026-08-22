import { useMemo, useState } from 'react';
import { Plus, Minus, Check, Settings2, Trash2, Flame, CircleCheckBig } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, ChoiceCard, Toggle } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { HABIT_TEMPLATES, HABIT_STEP, HABIT_UNIT_LABEL, habitsFromTemplates } from '@/data/habits';
import { addDays, DAY_MIN, formatDate, today, weekdayOf } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { HabitDefinition } from '@/types';

export default function Habits() {
  const { profile } = useAuth();
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const logHabit = useData((s) => s.logHabit);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);

  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<HabitDefinition | null>(null);

  const active = habits.filter((h) => h.active).sort((a, b) => a.order - b.order);
  const last14 = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today(), -(13 - i))), []);

  const valueFor = (habitId: string, date: string) =>
    habitLogs.find((l) => l.habit_id === habitId && l.date === date)?.value ?? 0;

  const streakFor = (habit: HabitDefinition) => {
    let streak = 0;
    let cursor = today();
    if (valueFor(habit.id, cursor) < habit.target) cursor = addDays(cursor, -1);
    while (valueFor(habit.id, cursor) >= habit.target && streak < 400) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  };

  const completedToday = active.filter((h) => valueFor(h.id, today()) >= h.target).length;

  const addTemplates = async (keys: string[]) => {
    if (!profile) return;
    const existing = new Set(habits.map((h) => h.key));
    const toAdd = habitsFromTemplates(profile.id, keys.filter((k) => !existing.has(k)));
    for (const h of toAdd) await put('habit_definitions', { ...h, order: habits.length });
    // Reactivate any that were previously switched off.
    for (const h of habits) {
      const wanted = keys.includes(h.key);
      if (h.active !== wanted) await put('habit_definitions', { ...h, active: wanted });
    }
    toast.success('Habits updated');
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Healthy Habits"
        title="Small things, done often"
        subtitle="Track only what you will actually keep up with. Nothing here is mandatory, and there is no penalty for a missed day."
        actions={<Button variant="outline" size="sm" onClick={() => setManageOpen(true)} icon={<Settings2 size={14} />}>Manage habits</Button>}
      />

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CircleCheckBig size={22} />}
            title="No habits being tracked"
            body="Pick two or three you can realistically keep up. You can always add more later."
            action={<Button onClick={() => setManageOpen(true)} icon={<Plus size={15} />}>Choose habits</Button>}
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Today"
              subtitle={formatDate(today(), 'long')}
              action={
                <Badge tone={completedToday === active.length ? 'success' : 'muted'}>
                  {completedToday} of {active.length} complete
                </Badge>
              }
            />
            <ul className="p-4 pt-2 space-y-2.5">
              {active.map((habit) => {
                const value = valueFor(habit.id, today());
                const pct = Math.min(100, (value / habit.target) * 100);
                const done = value >= habit.target;
                const step = HABIT_STEP[habit.unit];
                return (
                  <li key={habit.id} className={cn('rounded-2xl border p-3.5 transition-colors', done ? 'border-success/40 bg-success-soft/30' : 'border-line')}>
                    <div className="flex items-center gap-3">
                      <span
                        className="h-10 w-10 shrink-0 rounded-xl grid place-items-center"
                        style={{ background: `${habit.color}22`, color: habit.color }}
                      >
                        <Icon name={habit.icon} size={18} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          {habit.name}
                          {done && <Check size={14} className="text-success" aria-label="Target met" />}
                        </p>
                        <p className="text-2xs text-ink-3 tabular">
                          {value.toLocaleString()} / {habit.target.toLocaleString()} {HABIT_UNIT_LABEL[habit.unit]}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void logHabit(habit.id, today(), Math.max(0, value - step))}
                          aria-label={`Decrease ${habit.name}`}
                          className="h-10 w-10 grid place-items-center rounded-xl border border-line bg-surface active:scale-95"
                        >
                          <Minus size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void logHabit(habit.id, today(), value + step)}
                          aria-label={`Increase ${habit.name}`}
                          className="h-10 w-10 grid place-items-center rounded-xl bg-brand text-brand-contrast active:scale-95"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${pct}%`, backgroundColor: habit.color }}
                      />
                    </div>

                    {streakFor(habit) > 0 && (
                      <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-3">
                        <Flame size={11} className="text-warn" />
                        {streakFor(habit)}-day streak
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Last two weeks" subtitle="A filled square means you hit the target that day" />
            <div className="p-5 pt-2 overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <caption className="sr-only">Habit completion over the last 14 days</caption>
                <thead>
                  <tr>
                    <th scope="col" className="text-left text-2xs font-semibold text-ink-3 pb-2 w-32">Habit</th>
                    {last14.map((d) => (
                      <th key={d} scope="col" className="text-center text-2xs font-medium text-ink-3 pb-2">
                        {DAY_MIN[weekdayOf(d)]}
                      </th>
                    ))}
                    <th scope="col" className="text-right text-2xs font-semibold text-ink-3 pb-2 w-14">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((habit) => {
                    const hits = last14.filter((d) => valueFor(habit.id, d) >= habit.target).length;
                    return (
                      <tr key={habit.id}>
                        <th scope="row" className="text-left text-xs font-medium py-1.5 pr-2 truncate">{habit.name}</th>
                        {last14.map((d) => {
                          const v = valueFor(habit.id, d);
                          const ratio = Math.min(1, v / habit.target);
                          return (
                            <td key={d} className="py-1.5 px-0.5">
                              <div
                                className="mx-auto h-6 w-6 rounded-md border border-line"
                                style={{ backgroundColor: ratio > 0 ? `${habit.color}${Math.round(ratio * 200 + 40).toString(16).padStart(2, '0')}` : undefined }}
                                title={`${formatDate(d, 'medium')}: ${v} / ${habit.target}`}
                              >
                                <span className="sr-only">{`${habit.name} on ${formatDate(d, 'medium')}: ${v} of ${habit.target}`}</span>
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-right text-xs font-semibold tabular">{hits}/14</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage habits"
        description="Turn on what you want to track. Turning one off keeps its history."
        size="md"
      >
        <div className="space-y-2.5">
          {HABIT_TEMPLATES.map((t) => {
            const existing = habits.find((h) => h.key === t.key);
            const on = existing?.active ?? false;
            return (
              <ChoiceCard
                key={t.key}
                multi
                selected={on}
                onSelect={() => {
                  const keys = habits.filter((h) => h.active).map((h) => h.key);
                  const next = on ? keys.filter((k) => k !== t.key) : [...keys, t.key];
                  void addTemplates(next);
                }}
                title={t.name}
                description={t.blurb}
                badge={existing ? <Badge size="sm" tone="muted">{existing.target} {HABIT_UNIT_LABEL[existing.unit]}</Badge> : undefined}
              />
            );
          })}
        </div>

        {habits.length > 0 && (
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-sm font-semibold mb-2">Adjust targets</p>
            <ul className="space-y-1.5">
              {habits.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{h.name}</span>
                  <button type="button" onClick={() => setEditing(h)} className="text-2xs font-semibold text-brand-text hover:underline">
                    {h.target} {HABIT_UNIT_LABEL[h.unit]}
                  </button>
                  <button
                    type="button"
                    onClick={() => void del('habit_definitions', h.id)}
                    aria-label={`Delete ${h.name}`}
                    className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={`Adjust ${editing.name}`}
          size="sm"
          footer={
            <Button block onClick={async () => { await put('habit_definitions', editing); setEditing(null); toast.success('Target updated'); }}>
              Save
            </Button>
          }
        >
          <Input
            label={`Daily target (${HABIT_UNIT_LABEL[editing.unit] || 'count'})`}
            type="number" inputMode="decimal" min={1}
            value={editing.target}
            onChange={(e) => setEditing({ ...editing, target: Math.max(1, Number(e.target.value) || 1) })}
            inputSize="lg"
          />
          <div className="mt-4">
            <Toggle
              checked={editing.active}
              onChange={(v) => setEditing({ ...editing, active: v })}
              label="Track this habit"
              description="Switching off hides it from your daily list but keeps every logged day."
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
