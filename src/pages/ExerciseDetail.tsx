import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Shuffle, TrendingUp, Plus,
  History, Info, Sparkles, Target,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { MuscleMap, MuscleMapLegend } from '@/components/MuscleMap';
import { MultiLineChart } from '@/components/charts/Charts';
import { StatTile } from '@/components/dashboard/StatTile';
import { useData } from '@/store/data';
import { useExerciseHistory } from '@/lib/selectors';
import { getExercise, EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { suggestProgression, strengthTrend } from '@/lib/fitness/progression';
import { displayWeight, fmtWeight, weightUnit } from '@/lib/fitness/units';
import { formatDate, relativeDay } from '@/lib/date';
import { titleCase } from '@/lib/utils';
import type { Equipment } from '@/types';

export default function ExerciseDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const exercise = getExercise(slug);
  const equipment = useData((s) => s.fitnessProfile?.equipment ?? (['bodyweight'] as Equipment[]));
  const experience = useData((s) => s.fitnessProfile?.experience ?? 'beginner');
  const units = useData((s) => s.preferences?.units ?? 'metric');
  const records = useData((s) => s.records);
  const history = useExerciseHistory(slug);

  const suggestion = useMemo(
    () => (exercise ? suggestProgression(history, exercise, experience, 10, 3) : null),
    [history, exercise, experience],
  );
  const trend = useMemo(() => strengthTrend(history), [history]);

  const chart = useMemo(
    () =>
      [...history].reverse().map((h) => ({
        date: h.date,
        e1rm: h.best1RM !== null ? displayWeight(h.best1RM, units) ?? 0 : 0,
        volume: Math.round(h.volume),
      })),
    [history, units],
  );

  if (!exercise) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          icon={<AlertTriangle size={22} />}
          title="Exercise not found"
          body="That exercise is not in the library. It may have been renamed."
          action={<Button to="/exercises">Back to the library</Button>}
        />
      </div>
    );
  }

  const exerciseRecords = records.filter((r) => r.exercise_slug === slug);
  const alternatives = exercise.alternatives.map(getExercise).filter(Boolean);
  const available = canPerform(exercise, equipment);

  return (
    <div className="space-y-5 max-w-5xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <Card>
        <div className="grid sm:grid-cols-[auto,1fr] gap-5 p-5">
          <div className="rounded-2xl bg-surface-2 border border-line p-3 self-start mx-auto sm:mx-0">
            <MuscleMap primary={exercise.primary} secondary={exercise.secondary} view="both" size={76} showLabels />
            <div className="mt-2 flex justify-center">
              <MuscleMapLegend />
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight leading-tight">{exercise.name}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={exercise.difficulty === 'beginner' ? 'success' : exercise.difficulty === 'advanced' ? 'warn' : 'muted'}>
                {titleCase(exercise.difficulty)}
              </Badge>
              <Badge tone="muted">{titleCase(exercise.mechanic)}</Badge>
              <Badge tone="muted">{titleCase(exercise.type)}</Badge>
              <Badge tone="muted">{titleCase(exercise.force)}</Badge>
              {exercise.unilateral && <Badge tone="info">One side at a time</Badge>}
              {!available && <Badge tone="warn">Equipment you have not listed</Badge>}
            </div>

            <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-2xs uppercase tracking-wider text-ink-3">Primary muscles</dt>
                <dd className="font-medium">{exercise.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
              </div>
              {exercise.secondary.length > 0 && (
                <div>
                  <dt className="text-2xs uppercase tracking-wider text-ink-3">Secondary</dt>
                  <dd className="font-medium">{exercise.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}</dd>
                </div>
              )}
              <div>
                <dt className="text-2xs uppercase tracking-wider text-ink-3">Equipment</dt>
                <dd className="font-medium">{exercise.equipment.map((e) => EQUIPMENT_LABEL[e] ?? e).join(', ')}</dd>
              </div>
              {exercise.tempo_hint && (
                <div>
                  <dt className="text-2xs uppercase tracking-wider text-ink-3">Suggested tempo</dt>
                  <dd className="font-medium tabular">{exercise.tempo_hint}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" to="/workout" icon={<Plus size={14} />}>Add to today's workout</Button>
              <Button size="sm" variant="outline" to="/exercises" icon={<Shuffle size={14} />}>Browse library</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr,320px] gap-4">
        <div className="space-y-4">
          {/* Instructions */}
          <Card>
            <CardHeader title="Step-by-step" icon={<CheckCircle2 size={16} className="text-success" />} />
            <ol className="p-5 pt-3 space-y-3">
              {exercise.instructions.map((line, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-brand-soft text-brand-text grid place-items-center text-2xs font-bold tabular">
                    {i + 1}
                  </span>
                  <span className="text-sm text-ink-2 leading-relaxed pt-0.5">{line}</span>
                </li>
              ))}
            </ol>
          </Card>

          {/* Mistakes */}
          {exercise.mistakes.length > 0 && (
            <Card>
              <CardHeader title="Common mistakes" icon={<XCircle size={16} className="text-warn" />} />
              <ul className="p-5 pt-3 space-y-2.5">
                {exercise.mistakes.map((m, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-2 leading-relaxed">
                    <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
                    {m}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Safety */}
          {exercise.safety.length > 0 && (
            <Card className="border-danger/30">
              <CardHeader title="Safety" icon={<AlertTriangle size={16} className="text-danger" />} />
              <ul className="p-5 pt-3 space-y-2.5">
                {exercise.safety.map((s, i) => (
                  <li key={i} className="text-sm text-ink-2 leading-relaxed">{s}</li>
                ))}
              </ul>
              <div className="px-5 pb-5">
                <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  Stop any exercise that causes sharp pain, and seek medical assistance for chest pain,
                  faintness or severe breathing difficulty.
                </p>
              </div>
            </Card>
          )}

          {/* Variations */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Card>
              <CardHeader title="Easier variation" dense />
              <p className="px-4 pb-4 pt-2 text-sm text-ink-2 leading-relaxed">{exercise.beginner_variation}</p>
            </Card>
            <Card>
              <CardHeader title="Harder variation" dense />
              <p className="px-4 pb-4 pt-2 text-sm text-ink-2 leading-relaxed">{exercise.advanced_variation}</p>
            </Card>
          </div>

          {/* Your history */}
          <Card>
            <CardHeader
              title="Your history"
              subtitle={history.length ? `${history.length} logged sessions` : 'Nothing logged yet'}
              icon={<History size={16} />}
              action={trend !== null ? <Badge tone={trend > 0 ? 'success' : 'muted'}>{trend > 0 ? '+' : ''}{trend}% in 4 weeks</Badge> : undefined}
            />
            {history.length === 0 ? (
              <EmptyState
                compact
                icon={<TrendingUp size={20} />}
                title="No sessions logged"
                body="Once you log this exercise, your strength trend and progression suggestions appear here."
              />
            ) : (
              <>
                {chart.length >= 2 && (
                  <div className="p-3">
                    <MultiLineChart
                      data={chart}
                      series={[{ key: 'e1rm', name: `Estimated 1RM (${weightUnit(units)})`, color: '#B9F227' }]}
                      height={200}
                    />
                  </div>
                )}
                <ul className="divide-y divide-line">
                  {history.slice(0, 8).map((h) => (
                    <li key={h.session_id} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                      <span className="w-24 shrink-0 text-ink-3">{relativeDay(h.date)}</span>
                      <span className="flex-1 tabular">
                        {h.sets.map((s, i) => (
                          <span key={s.id}>
                            {i > 0 && <span className="text-ink-3"> · </span>}
                            {s.weight_kg !== null ? `${displayWeight(s.weight_kg, units)}×${s.reps}` : `${s.reps ?? s.seconds}${s.reps ? '' : 's'}`}
                          </span>
                        ))}
                      </span>
                      <span className="text-2xs text-ink-3 tabular shrink-0">{formatDate(h.date, 'short')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          {suggestion && history.length > 0 && (
            <Card className="border-brand/40">
              <CardHeader title="Progression" dense icon={<Sparkles size={16} className="text-brand-text" />} />
              <div className="px-4 pb-4 pt-2">
                <p className="font-semibold text-sm">{suggestion.headline}</p>
                <p className="mt-1.5 text-sm text-ink-3 leading-relaxed">{suggestion.detail}</p>
                {suggestion.suggestedWeightKg !== null && (
                  <p className="mt-3 text-2xl font-black tabular text-brand-text">
                    {fmtWeight(suggestion.suggestedWeightKg, units)}
                  </p>
                )}
                <p className="mt-2 text-2xs text-ink-3">
                  A suggestion, not an instruction — your warm-up sets are the real signal.
                </p>
              </div>
            </Card>
          )}

          {exerciseRecords.length > 0 && (
            <Card>
              <CardHeader title="Your records" dense icon={<Target size={16} />} />
              <ul className="px-4 pb-4 pt-2 space-y-2">
                {exerciseRecords.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink-3 truncate">{titleCase(r.kind)}</span>
                    <span className="font-bold tabular shrink-0">
                      {r.unit === 'kg' ? fmtWeight(r.value, units) : `${r.value} ${r.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {history.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Sessions" value={history.length} />
              <StatTile
                label="Best 1RM"
                value={history.reduce((a, h) => Math.max(a, h.best1RM ?? 0), 0) || '—'}
                unit={history.some((h) => h.best1RM) ? weightUnit(units) : undefined}
              />
            </div>
          )}

          {alternatives.length > 0 && (
            <Card>
              <CardHeader title="Alternatives" dense subtitle="Similar training effect" />
              <ul className="px-3 pb-3 pt-1">
                {alternatives.map((alt) => (
                  <li key={alt!.slug}>
                    <Link
                      to={`/exercises/${alt!.slug}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-2 transition-colors"
                    >
                      <span className="shrink-0 rounded-lg bg-surface-2 border border-line p-1">
                        <MuscleMap primary={alt!.primary} view="front" size={26} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{alt!.name}</span>
                        <span className="block text-2xs text-ink-3 truncate">
                          {alt!.equipment.map((e) => EQUIPMENT_LABEL[e] ?? e).join(', ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
