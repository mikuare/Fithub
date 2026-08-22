import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, X, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Toggle } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { MuscleMap } from '@/components/MuscleMap';
import { useData } from '@/store/data';
import { useDebouncedValue } from '@/lib/hooks';
import { EXERCISES, EXERCISE_CATEGORIES, EQUIPMENT_LABEL, MUSCLE_LABEL } from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { cn, matches, titleCase } from '@/lib/utils';
import type { Difficulty, Equipment, ExerciseCategory, ExerciseType } from '@/types';

/* A stable reference: returning a fresh array from a Zustand selector makes
   every snapshot compare unequal, which re-renders forever. */
const DEFAULT_EQUIPMENT: Equipment[] = ['bodyweight'];

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
const TYPES: ExerciseType[] = ['strength', 'cardio', 'timed', 'mobility'];

export default function Exercises() {
  const equipment = useData((s) => s.fitnessProfile?.equipment ?? DEFAULT_EQUIPMENT);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 180);
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [type, setType] = useState<ExerciseType | 'all'>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(
    () =>
      EXERCISES.filter((e) => {
        if (category !== 'all' && e.category !== category) return false;
        if (difficulty !== 'all' && e.difficulty !== difficulty) return false;
        if (type !== 'all' && e.type !== type) return false;
        if (onlyMine && !canPerform(e, equipment)) return false;
        if (!debounced.trim()) return true;
        return (
          matches(e.name, debounced) ||
          e.primary.some((m) => matches(MUSCLE_LABEL[m], debounced)) ||
          e.secondary.some((m) => matches(MUSCLE_LABEL[m], debounced)) ||
          e.equipment.some((eq) => matches(EQUIPMENT_LABEL[eq] ?? eq, debounced))
        );
      }),
    [debounced, category, difficulty, type, onlyMine, equipment],
  );

  const activeFilters = [category !== 'all', difficulty !== 'all', type !== 'all', onlyMine].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Exercise Library"
        title={`${EXERCISES.length} exercises`}
        subtitle="Every entry has step-by-step instructions, the mistakes people actually make, safety notes and easier or harder variations."
      />

      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, muscle or equipment…"
          prefix={<Search size={15} />}
          aria-label="Search exercises"
          className="flex-1 min-w-[240px]"
        />
        <Button
          variant={activeFilters ? 'secondary' : 'outline'}
          onClick={() => setFiltersOpen((v) => !v)}
          icon={<SlidersHorizontal size={15} />}
          aria-expanded={filtersOpen}
        >
          Filters{activeFilters > 0 && ` (${activeFilters})`}
        </Button>
      </div>

      {filtersOpen && (
        <Card className="animate-fade-in">
          <div className="p-4 space-y-4">
            <FilterRow
              label="Category"
              options={[{ value: 'all', label: 'All' }, ...EXERCISE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))]}
              value={category}
              onChange={(v) => setCategory(v as ExerciseCategory | 'all')}
            />
            <FilterRow
              label="Difficulty"
              options={[{ value: 'all', label: 'All' }, ...DIFFICULTIES.map((d) => ({ value: d, label: titleCase(d) }))]}
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty | 'all')}
            />
            <FilterRow
              label="Type"
              options={[{ value: 'all', label: 'All' }, ...TYPES.map((t) => ({ value: t, label: titleCase(t) }))]}
              value={type}
              onChange={(v) => setType(v as ExerciseType | 'all')}
            />
            <Toggle
              checked={onlyMine}
              onChange={setOnlyMine}
              label="Only exercises I have equipment for"
              description="Based on the equipment list in your fitness profile."
            />
            {activeFilters > 0 && (
              <Button
                variant="ghost" size="sm" icon={<X size={14} />}
                onClick={() => { setCategory('all'); setDifficulty('all'); setType('all'); setOnlyMine(false); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      )}

      <p className="text-sm text-ink-3 tabular">
        {results.length} {results.length === 1 ? 'exercise' : 'exercises'}
        {debounced.trim() && ` matching "${debounced}"`}
      </p>

      {results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={22} />}
            title="No exercises match"
            body="Try a broader search, or clear the equipment filter to see everything in the library."
            action={
              <Button onClick={() => { setQuery(''); setCategory('all'); setDifficulty('all'); setType('all'); setOnlyMine(false); }}>
                Reset search
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {results.map((e) => (
            <li key={e.slug}>
              <Link
                to={`/exercises/${e.slug}`}
                className="card p-4 flex gap-3 h-full hover:border-brand/40 transition-colors group"
              >
                <div className="shrink-0 rounded-xl bg-surface-2 border border-line p-1.5 self-start">
                  <MuscleMap primary={e.primary} secondary={e.secondary} view="front" size={42} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-sm leading-snug group-hover:text-brand-text transition-colors">{e.name}</h3>
                  <p className="mt-1 text-2xs text-ink-3 capitalize truncate">
                    {e.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <Badge size="sm" tone={e.difficulty === 'beginner' ? 'success' : e.difficulty === 'advanced' ? 'warn' : 'muted'}>
                      {e.difficulty}
                    </Badge>
                    <Badge size="sm" tone="muted">{e.mechanic}</Badge>
                    {!canPerform(e, equipment) && <Badge size="sm" tone="info">Needs kit</Badge>}
                  </div>
                  <p className="mt-2 text-2xs text-ink-3 truncate">
                    {e.equipment.map((eq) => EQUIPMENT_LABEL[eq] ?? eq).join(', ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterRow({ label, options, value, onChange }: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
              value === o.value ? 'bg-brand text-brand-contrast border-brand' : 'border-line text-ink-2 hover:border-line-strong',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
