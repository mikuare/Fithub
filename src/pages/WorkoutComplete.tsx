import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Check, Flame, Trophy, Home, TrendingUp, Info, BatteryCharging, Clock, Layers, Repeat,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Field';
import { Confetti } from '@/components/Confetti';
import { LoadingScreen } from '@/components/ui/States';
import { useData } from '@/store/data';
import { useTimer } from '@/store/timer';
import { cues } from '@/lib/audio';
import { sessionStats } from '@/lib/selectors';
import { getExercise } from '@/data/exercises';
import { RECORD_KIND_LABEL } from '@/lib/fitness/records';
import { fmtWeight } from '@/lib/fitness/units';
import { formatDuration, cn, formatNumber } from '@/lib/utils';
import { HEALTH_DISCLAIMER } from '@/lib/defaults';
import { toast } from '@/store/toast';
import type { Feeling, PersonalRecord, WorkoutSession } from '@/types';

const DIFFICULTY: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { value: 1, label: 'Very Easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Hard' },
  { value: 5, label: 'Very Hard' },
];

const FEELINGS: Array<{ value: Feeling; label: string; emoji: string }> = [
  { value: 'great', label: 'Great', emoji: '💪' },
  { value: 'good', label: 'Good', emoji: '🙂' },
  { value: 'normal', label: 'Normal', emoji: '😐' },
  { value: 'tired', label: 'Tired', emoji: '😮‍💨' },
  { value: 'exhausted', label: 'Exhausted', emoji: '🥵' },
];

export default function WorkoutComplete() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const sessions = useData((s) => s.sessions);
  const allSets = useData((s) => s.sets);
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const finishSession = useData((s) => s.finishSession);
  const timer = useTimer();

  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<WorkoutSession | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [saving, setSaving] = useState(false);

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const sets = useMemo(() => allSets.filter((s) => s.session_id === sessionId), [allSets, sessionId]);
  const stats = useMemo(() => sessionStats(sets), [sets]);

  const durationSeconds = useMemo(() => {
    if (!session?.started_at) return session?.duration_seconds ?? 0;
    if (session.status === 'completed') return session.duration_seconds;
    return Math.max(60, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000));
  }, [session]);

  useEffect(() => {
    timer.stop();
    if (session) setNotes(session.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  if (!session) return <LoadingScreen label="Loading your session" />;

  const submit = async () => {
    setSaving(true);
    try {
      const result = await finishSession(session.id, {
        durationSeconds,
        difficulty,
        feeling,
        notes,
      });
      setSaved(result.session);
      setRecords(result.newRecords);
      if (result.newRecords.length) cues.record();
      else cues.complete();
    } catch {
      toast.error('Could not save the summary', 'Your sets are safe — try again.');
      setSaving(false);
    }
  };

  const done = saved !== null;

  return (
    <div className="min-h-screen bg-bg">
      {done && records.length > 0 && <Confetti />}

      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-20">
        <div className="text-center">
          <div className={cn(
            'mx-auto h-16 w-16 rounded-3xl grid place-items-center animate-pop',
            records.length ? 'bg-warn-soft text-warn' : 'bg-brand text-brand-contrast',
          )}>
            {records.length ? <Trophy size={30} /> : <Check size={32} strokeWidth={3} />}
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tighter uppercase">
            {done ? 'Workout complete' : 'Nice work'}
          </h1>
          <p className="mt-2 text-ink-3">{session.title}</p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Duration', value: formatDuration(durationSeconds, true), icon: Clock },
            { label: 'Exercises', value: String(stats.exercises), icon: Repeat },
            { label: 'Sets', value: String(stats.sets), icon: Layers },
            {
              label: 'Total volume',
              value: stats.volume > 0 ? fmtWeight(stats.volume, units, 0) : '—',
              icon: TrendingUp,
            },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <s.icon size={15} className="mx-auto text-ink-3" aria-hidden />
              <p className="mt-2 text-xl font-black tabular leading-tight">{s.value}</p>
              <p className="mt-0.5 text-2xs text-ink-3 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Calories — only when it can be estimated honestly */}
        {done && saved?.est_calories !== null && saved?.est_calories !== undefined && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-3">
            <Flame size={14} className="text-warn" />
            <span className="tabular font-semibold text-ink-2">≈ {formatNumber(saved.est_calories)} kcal</span>
            <span className="text-2xs">estimated from exercise intensity and your bodyweight</span>
          </p>
        )}

        {/* Records */}
        {done && records.length > 0 && (
          <Card className="mt-5 border-warn/40">
            <CardHeader
              title={records.length === 1 ? 'New personal record' : `${records.length} new personal records`}
              icon={<Trophy size={17} className="text-warn" />}
            />
            <ul className="px-5 pb-5 pt-1 space-y-2">
              {records.map((r) => (
                <li key={r.id} className="flex items-center gap-3">
                  <span className="text-lg" aria-hidden>🏆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{getExercise(r.exercise_slug)?.name}</p>
                    <p className="text-2xs text-ink-3">{RECORD_KIND_LABEL[r.kind]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black tabular">
                      {r.unit === 'kg' ? fmtWeight(r.value, units) : `${r.value} ${r.unit}`}
                    </p>
                    {r.previous_value !== null && (
                      <p className="text-2xs text-success tabular">
                        +{Math.round((r.value - r.previous_value) * 10) / 10} from {r.previous_value}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Feedback form */}
        {!done ? (
          <div className="mt-8 space-y-6">
            <div>
              <h2 className="font-semibold">How difficult was this workout?</h2>
              <p className="text-2xs text-ink-3 mt-0.5">This tunes how hard your next session is prescribed.</p>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {DIFFICULTY.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={difficulty === d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={cn(
                      'py-3 px-1 rounded-xl border text-center transition-all active:scale-95',
                      difficulty === d.value
                        ? 'bg-brand text-brand-contrast border-brand'
                        : 'bg-surface border-line text-ink-2 hover:border-line-strong',
                    )}
                  >
                    <span className="block text-lg font-black tabular">{d.value}</span>
                    <span className="block text-[10px] mt-0.5 leading-tight">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-semibold">How do you feel?</h2>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {FEELINGS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={feeling === f.value}
                    onClick={() => setFeeling(f.value)}
                    className={cn(
                      'py-3 px-1 rounded-xl border text-center transition-all active:scale-95',
                      feeling === f.value
                        ? 'bg-accent-soft border-accent/50'
                        : 'bg-surface border-line hover:border-line-strong',
                    )}
                  >
                    <span className="block text-xl" aria-hidden>{f.emoji}</span>
                    <span className={cn('block text-[10px] mt-1', feeling === f.value ? 'text-ink font-semibold' : 'text-ink-3')}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Textarea
              label="Workout notes"
              hint="Optional — these can influence future workout recommendations."
              placeholder="e.g. Left shoulder felt slightly uncomfortable during incline press."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <Button size="xl" block onClick={() => void submit()} loading={saving} icon={<Check size={19} />}>
              Save workout
            </Button>

            <p className="text-2xs text-ink-3 leading-relaxed">{HEALTH_DISCLAIMER}</p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            <Card>
              <div className="p-5">
                <p className="flex items-start gap-2.5 text-sm text-ink-2 leading-relaxed">
                  <Info size={15} className="shrink-0 mt-0.5 text-ink-3" />
                  <span>
                    Your progress, goals, records and FitScore have all been updated from this session.
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="success">Progress updated</Badge>
                  <Badge tone="success">Goals recalculated</Badge>
                  <Badge tone="success">FitScore refreshed</Badge>
                  {records.length > 0 && <Badge tone="warn">Records checked</Badge>}
                </div>
              </div>
            </Card>

            <Card className="border-accent/30">
              <div className="p-5 flex items-start gap-3">
                <span className="h-10 w-10 rounded-xl bg-accent-soft grid place-items-center text-accent-text shrink-0">
                  <BatteryCharging size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">Log how you are recovering</h3>
                  <p className="mt-1 text-sm text-ink-3 leading-relaxed">
                    A 20-second check-in on sleep, energy and soreness is what makes tomorrow's readiness score meaningful.
                  </p>
                  <Button size="sm" className="mt-3" to="/recovery">Recovery check-in</Button>
                </div>
              </div>
            </Card>

            <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
              <Button size="lg" variant="outline" onClick={() => navigate('/')} icon={<Home size={17} />}>
                Back to dashboard
              </Button>
              <Button size="lg" to="/progress" icon={<TrendingUp size={17} />}>
                See my progress
              </Button>
            </div>

            <p className="text-center text-sm text-ink-3 pt-2">
              <Link to="/review" className="hover:underline">View this week's review →</Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
