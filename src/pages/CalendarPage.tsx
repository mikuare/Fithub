import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CalendarDays, Play, Check, Moon, X, Flag, ClipboardCheck, Info,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Icon } from '@/components/Icon';
import { useData } from '@/store/data';
import { useActiveProgram } from '@/lib/selectors';
import { SESSION_KIND_META } from '@/lib/fitness/program';
import {
  DAY_MIN, MONTH_NAMES, addDays, addMonths, endOfMonth, formatDate, fromISODate,
  startOfMonth, startOfWeek, today, weekdayOf,
} from '@/lib/date';
import { cn, humanDuration } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { ISODate, ProgramDay, WorkoutSession } from '@/types';

interface DayCell {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  session: WorkoutSession | null;
  planned: ProgramDay | null;
  missed: boolean;
  goalDue: string[];
}

export default function CalendarPage() {
  const sessions = useData((s) => s.sessions);
  const goals = useData((s) => s.goals);
  const assessments = useData((s) => s.assessments);
  const put = useData((s) => s.put);
  const program = useActiveProgram();
  const weekStartsOn = useData((s) => s.preferences?.week_starts_on ?? 1);

  const [cursor, setCursor] = useState<ISODate>(startOfMonth(today()));
  const [selected, setSelected] = useState<ISODate | null>(null);

  const cells = useMemo<DayCell[]>(() => {
    const first = startOfWeek(startOfMonth(cursor), weekStartsOn);
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const out: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = addDays(first, i);
      const session = sessions.find((s) => s.date === date && s.status !== 'skipped') ?? null;
      const planned = program?.days.find((d) => d.weekday === weekdayOf(date)) ?? null;
      const isPast = date < today();
      out.push({
        date,
        inMonth: date >= monthStart && date <= monthEnd,
        isToday: date === today(),
        session,
        planned,
        missed: isPast && !session && !!planned && planned.kind !== 'rest',
        goalDue: goals.filter((g) => g.target_date === date && !g.archived).map((g) => g.title),
      });
    }
    return out;
  }, [cursor, sessions, program, goals, weekStartsOn]);

  const monthDate = fromISODate(cursor);
  const monthSessions = sessions.filter(
    (s) => s.status === 'completed' && s.date >= startOfMonth(cursor) && s.date <= endOfMonth(cursor),
  );
  const monthMinutes = Math.round(monthSessions.reduce((a, s) => a + s.duration_seconds / 60, 0));

  const dayLabels = weekStartsOn === 1
    ? [...DAY_MIN.slice(1), DAY_MIN[0]]
    : [...DAY_MIN];

  const selectedCell = cells.find((c) => c.date === selected) ?? null;

  /** Drag-and-drop reschedule: move a scheduled programme day to another weekday. */
  const onDrop = async (fromDate: ISODate, toDate: ISODate) => {
    if (!program || fromDate === toDate) return;
    const fromWeekday = weekdayOf(fromDate);
    const toWeekday = weekdayOf(toDate);
    const source = program.days.find((d) => d.weekday === fromWeekday);
    const target = program.days.find((d) => d.weekday === toWeekday);
    if (!source || !target) return;
    const days = program.days.map((d) => {
      if (d.weekday === fromWeekday) return { ...target, id: d.id, weekday: fromWeekday };
      if (d.weekday === toWeekday) return { ...source, id: d.id, weekday: toWeekday };
      return d;
    });
    await put('programs', { ...program, days });
    toast.success('Schedule updated', `${source.title} moved to ${formatDate(toDate, 'day')}.`);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Calendar"
        title="Your training month"
        subtitle="Scheduled sessions, what you completed, rest days and goal deadlines in one view. Drag a session onto another day to reschedule it."
        actions={<Button size="sm" to="/workout" icon={<Play size={14} />}>Today's workout</Button>}
      />

      <Card>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-bold">
              {MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}
            </h2>
            <p className="text-2xs text-ink-3 tabular">
              {monthSessions.length} workouts · {humanDuration(monthMinutes * 60)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2">
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => setCursor(startOfMonth(today()))}
              className="h-9 px-3 rounded-xl border border-line text-sm font-medium hover:bg-surface-2">
              Today
            </button>
            <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month"
              className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2">
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayLabels.map((d, i) => (
              <div key={i} className="text-center text-2xs font-semibold uppercase tracking-wider text-ink-3 py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => (
              <button
                key={cell.date}
                type="button"
                draggable={!!cell.planned && cell.planned.kind !== 'rest'}
                onDragStart={(e) => e.dataTransfer.setData('text/plain', cell.date)}
                onDragOver={(e) => { if (program) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); void onDrop(e.dataTransfer.getData('text/plain'), cell.date); }}
                onClick={() => setSelected(cell.date)}
                aria-label={`${formatDate(cell.date, 'long')}${cell.session ? ', completed' : cell.missed ? ', missed' : ''}`}
                aria-current={cell.isToday ? 'date' : undefined}
                className={cn(
                  'relative aspect-square sm:aspect-[4/3] rounded-xl border p-1.5 text-left transition-all',
                  'flex flex-col gap-0.5 overflow-hidden',
                  !cell.inMonth && 'opacity-35',
                  cell.isToday ? 'border-brand bg-brand-soft/40' : 'border-line hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <span className={cn('text-2xs font-bold tabular', cell.isToday ? 'text-brand-text' : 'text-ink-3')}>
                  {fromISODate(cell.date).getDate()}
                </span>

                {cell.session?.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-success truncate">
                    <Check size={9} className="shrink-0" />
                    <span className="truncate hidden sm:inline">{cell.session.title}</span>
                  </span>
                )}
                {cell.session?.status === 'in_progress' && (
                  <span className="text-[9px] font-semibold text-brand-text truncate">In progress</span>
                )}
                {!cell.session && cell.planned && cell.planned.kind !== 'rest' && (
                  <span className={cn('flex items-center gap-1 text-[9px] truncate', cell.missed ? 'text-danger' : 'text-ink-2')}>
                    {cell.missed ? <X size={9} className="shrink-0" /> : <Icon name={SESSION_KIND_META[cell.planned.kind].icon} size={9} className="shrink-0" />}
                    <span className="truncate hidden sm:inline">{cell.planned.title}</span>
                  </span>
                )}
                {!cell.session && cell.planned?.kind === 'rest' && (
                  <span className="flex items-center gap-1 text-[9px] text-ink-3">
                    <Moon size={9} /><span className="hidden sm:inline">Rest</span>
                  </span>
                )}

                {cell.goalDue.length > 0 && (
                  <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" title="Goal deadline" />
                )}
                {assessments.some((a) => a.taken_at.slice(0, 10) === cell.date) && (
                  <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-info" title="Assessment" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line flex flex-wrap gap-x-5 gap-y-1.5 text-2xs text-ink-3">
          <span className="inline-flex items-center gap-1.5"><Check size={11} className="text-success" /> Completed</span>
          <span className="inline-flex items-center gap-1.5"><X size={11} className="text-danger" /> Missed</span>
          <span className="inline-flex items-center gap-1.5"><Moon size={11} /> Rest day</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Goal deadline</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-info" /> Assessment</span>
        </div>
      </Card>

      {selectedCell && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={formatDate(selectedCell.date, 'long')}
          size="md"
        >
          <div className="space-y-4">
            {selectedCell.session ? (
              <div className="p-4 rounded-2xl border border-success/40 bg-success-soft/30">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-success" />
                  <p className="font-semibold">{selectedCell.session.title}</p>
                </div>
                <p className="mt-1.5 text-sm text-ink-3 tabular">
                  {humanDuration(selectedCell.session.duration_seconds)}
                  {selectedCell.session.difficulty ? ` · difficulty ${selectedCell.session.difficulty}/5` : ''}
                  {selectedCell.session.feeling ? ` · felt ${selectedCell.session.feeling}` : ''}
                </p>
                {selectedCell.session.notes && (
                  <p className="mt-2 text-sm text-ink-2 leading-relaxed">{selectedCell.session.notes}</p>
                )}
              </div>
            ) : selectedCell.planned && selectedCell.planned.kind !== 'rest' ? (
              <div className={cn('p-4 rounded-2xl border', selectedCell.missed ? 'border-danger/30 bg-danger-soft/30' : 'border-line')}>
                <div className="flex items-center gap-2">
                  <Icon name={SESSION_KIND_META[selectedCell.planned.kind].icon} size={16} className="text-ink-2" />
                  <p className="font-semibold">{selectedCell.planned.title}</p>
                  {selectedCell.missed && <Badge tone="danger" size="sm">Missed</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-3">{selectedCell.planned.focus}</p>
                <ol className="mt-3 space-y-1">
                  {selectedCell.planned.exercises.map((pe, i) => (
                    <li key={pe.id} className="text-sm flex gap-2.5">
                      <span className="w-4 text-2xs text-ink-3 tabular">{i + 1}</span>
                      <span className="flex-1">{pe.exercise_slug.replace(/-/g, ' ')}</span>
                      <span className="text-2xs text-ink-3 tabular">
                        {pe.target_seconds ? `${pe.sets}×${pe.target_seconds}s` : `${pe.sets}×${pe.target_reps}`}
                      </span>
                    </li>
                  ))}
                </ol>
                {selectedCell.date === today() && (
                  <Button size="sm" className="mt-4" to="/workout" icon={<Play size={14} />}>Start this workout</Button>
                )}
                {selectedCell.missed && (
                  <p className="mt-3 flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                    <Info size={12} className="shrink-0 mt-0.5" />
                    A missed session is data, not a verdict. If it keeps happening on the same weekday, move it.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-line text-center">
                <Moon size={20} className="mx-auto text-ink-3" />
                <p className="mt-2 font-semibold">Rest day</p>
                <p className="text-sm text-ink-3 mt-0.5">Scheduled recovery — it keeps your streak intact.</p>
              </div>
            )}

            {selectedCell.goalDue.length > 0 && (
              <div className="p-4 rounded-2xl border border-accent/30">
                <p className="flex items-center gap-2 font-semibold text-sm"><Flag size={15} className="text-accent-text" /> Goal deadline</p>
                <ul className="mt-2 space-y-1">
                  {selectedCell.goalDue.map((t) => <li key={t} className="text-sm text-ink-2">{t}</li>)}
                </ul>
                <Link to="/goals" className="mt-2 inline-block text-2xs font-semibold text-brand-text hover:underline">View goals →</Link>
              </div>
            )}

            {assessments.filter((a) => a.taken_at.slice(0, 10) === selectedCell.date).map((a) => (
              <div key={a.id} className="p-4 rounded-2xl border border-info/30">
                <p className="flex items-center gap-2 font-semibold text-sm"><ClipboardCheck size={15} className="text-info" /> FitStart assessment</p>
                <p className="mt-1 text-sm text-ink-3">Baseline recorded on this day.</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <Card>
        <CardHeader title="This month at a glance" icon={<CalendarDays size={16} />} />
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-line border-t border-line">
          {[
            ['Completed', String(monthSessions.length)],
            ['Time trained', humanDuration(monthMinutes * 60)],
            ['Missed', String(cells.filter((c) => c.inMonth && c.missed).length)],
            ['Rest days', String(cells.filter((c) => c.inMonth && c.planned?.kind === 'rest').length)],
          ].map(([label, value]) => (
            <div key={label} className="p-4 text-center">
              <p className="text-xl font-black tabular">{value}</p>
              <p className="text-2xs text-ink-3 uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
