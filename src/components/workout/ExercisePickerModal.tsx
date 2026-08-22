import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EXERCISES, EXERCISE_CATEGORIES, EQUIPMENT_LABEL } from '@/data/exercises';
import { canPerform } from '@/lib/fitness/program';
import { useData } from '@/store/data';
import { cn, matches } from '@/lib/utils';
import type { Equipment, Exercise, ExerciseCategory } from '@/types';

export function ExercisePickerModal({
  open, onClose, onPick, title = 'Add an exercise', excludeSlugs = [], preferCategory,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  excludeSlugs?: string[];
  preferCategory?: ExerciseCategory;
}) {
  const equipment = useData((s) => s.fitnessProfile?.equipment ?? (['bodyweight'] as Equipment[]));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>(preferCategory ?? 'all');
  const [onlyMyEquipment, setOnlyMyEquipment] = useState(true);

  const results = useMemo(() => {
    const excluded = new Set(excludeSlugs);
    return EXERCISES.filter((e) => {
      if (excluded.has(e.slug)) return false;
      if (category !== 'all' && e.category !== category) return false;
      if (onlyMyEquipment && !canPerform(e, equipment)) return false;
      if (!query.trim()) return true;
      return (
        matches(e.name, query) ||
        e.primary.some((m) => matches(m, query)) ||
        e.equipment.some((eq) => matches(EQUIPMENT_LABEL[eq] ?? eq, query))
      );
    });
  }, [query, category, onlyMyEquipment, equipment, excludeSlugs]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search 100+ exercises…"
        prefix={<Search size={15} />}
        aria-label="Search exercises"
        autoFocus
      />

      <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[{ key: 'all', label: 'All' }, ...EXERCISE_CATEGORIES].map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key as ExerciseCategory | 'all')}
            className={cn(
              'shrink-0 h-8 px-3 rounded-lg text-xs font-medium border transition-colors',
              category === c.key ? 'bg-brand text-brand-contrast border-brand' : 'border-line text-ink-2 hover:border-line-strong',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-ink-3 cursor-pointer">
        <input
          type="checkbox"
          checked={onlyMyEquipment}
          onChange={(e) => setOnlyMyEquipment(e.target.checked)}
          className="accent-[rgb(var(--c-brand))]"
        />
        Only show exercises I have equipment for
      </label>

      <ul className="mt-3 space-y-1.5 max-h-[46vh] overflow-y-auto -mx-1 px-1">
        {results.length === 0 && (
          <li className="py-10 text-center text-sm text-ink-3">
            No exercises match. Try clearing the equipment filter.
          </li>
        )}
        {results.slice(0, 80).map((e) => (
          <li key={e.slug}>
            <button
              type="button"
              onClick={() => { onPick(e); onClose(); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-brand/50 hover:bg-surface-2 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{e.name}</p>
                <p className="text-2xs text-ink-3 truncate capitalize">
                  {e.primary.join(' · ').replace(/_/g, ' ')} · {e.equipment.map((eq) => EQUIPMENT_LABEL[eq] ?? eq).join(', ')}
                </p>
              </div>
              <Badge size="sm" tone={e.difficulty === 'beginner' ? 'success' : e.difficulty === 'advanced' ? 'warn' : 'muted'}>
                {e.difficulty}
              </Badge>
              <Check size={15} className="text-ink-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
