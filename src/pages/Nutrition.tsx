import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple, Plus, Droplets, Trash2, Search, Info, Calculator, Save, ChevronLeft, ChevronRight,
  ScanBarcode, Target, Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing, ProgressBar } from '@/components/ui/Progress';
import { Modal } from '@/components/ui/Modal';
import { Input, Toggle } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { useData } from '@/store/data';
import { BarcodeScanner } from '@/components/nutrition/BarcodeScanner';
import { FOODS, type FoodItem } from '@/data/foods';
import { HABIT_STEP } from '@/data/habits';
import { bmr, tdee, activityLevelFromDays } from '@/lib/fitness/calculations';
import {
  foodBenefits, goalEatingStrategy, goalFit, remainingMacros, suggestFoods,
  GOAL_FIT_META, GOAL_LABEL,
} from '@/lib/fitness/foodiq';
import { ageFrom, addDays, formatDate, relativeDay, today } from '@/lib/date';
import { cn, formatNumber, matches } from '@/lib/utils';
import { toast } from '@/store/toast';
import type { GoalKind, MealSlot, NutritionLog } from '@/types';

const SLOTS: Array<{ key: MealSlot; label: string; emoji: string }> = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🥗' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
];

export default function Nutrition() {
  const nutrition = useData((s) => s.nutrition);
  const targets = useData((s) => s.nutritionTargets);
  const habits = useData((s) => s.habits);
  const habitLogs = useData((s) => s.habitLogs);
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const addNutrition = useData((s) => s.addNutrition);
  const logHabit = useData((s) => s.logHabit);
  const del = useData((s) => s.del);
  const put = useData((s) => s.put);

  const [date, setDate] = useState(today());
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [scanning, setScanning] = useState<MealSlot | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const dayLogs = useMemo(() => nutrition.filter((n) => n.date === date), [nutrition, date]);
  const totals = useMemo(
    () =>
      dayLogs.reduce(
        (a, n) => ({
          calories: a.calories + n.calories * n.servings,
          protein: a.protein + n.protein_g * n.servings,
          carbs: a.carbs + n.carbs_g * n.servings,
          fat: a.fat + n.fat_g * n.servings,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [dayLogs],
  );

  const waterHabit = habits.find((h) => h.key === 'water' && h.active);
  const waterValue = waterHabit
    ? habitLogs.find((l) => l.habit_id === waterHabit.id && l.date === date)?.value ?? 0
    : 0;

  const estimated = useMemo(() => {
    if (!fitnessProfile) return null;
    const basal = bmr(fitnessProfile.weight_kg, fitnessProfile.height_cm, ageFrom(fitnessProfile.birth_date), fitnessProfile.gender);
    if (basal === null) return null;
    const maintenance = tdee(basal, activityLevelFromDays(fitnessProfile.days_per_week));
    if (maintenance === null) return null;
    const goalAdjust =
      fitnessProfile.primary_goal === 'lose_fat' ? -0.18
        : fitnessProfile.primary_goal === 'build_muscle' ? 0.1
        : 0;
    const calories = Math.round(maintenance * (1 + goalAdjust));
    const protein = Math.round((fitnessProfile.weight_kg ?? 70) * (fitnessProfile.primary_goal === 'lose_fat' ? 2.2 : 1.8));
    const fat = Math.round((calories * 0.27) / 9);
    const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
    return { basal, maintenance, calories, protein, fat, carbs };
  }, [fitnessProfile]);

  if (!targets) return null;

  const goal: GoalKind = fitnessProfile?.primary_goal ?? 'general_fitness';
  const strategy = goalEatingStrategy(goal, fitnessProfile?.weight_kg ?? null);
  const remaining = remainingMacros(totals, {
    calories: targets.calories, protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g,
  });
  const suggestions = date === today() ? suggestFoods(FOODS, remaining, goal) : [];

  const defaultScanSlot = (): MealSlot => {
    const h = new Date().getHours();
    return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  };

  const macros = [
    { key: 'protein', label: 'Protein', value: totals.protein, target: targets.protein_g, color: '#B9F227', unit: 'g' },
    { key: 'carbs', label: 'Carbs', value: totals.carbs, target: targets.carbs_g, color: '#38BDF8', unit: 'g' },
    { key: 'fat', label: 'Fat', value: totals.fat, target: targets.fat_g, color: '#F5BE3E', unit: 'g' },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        eyebrow="Nutrition"
        title="Fuel for the training"
        subtitle="General fitness-oriented guidance. Targets are estimates — adjust them to what actually works for you."
        actions={
          <>
            <Button size="sm" onClick={() => setScanning(defaultScanSlot())} icon={<ScanBarcode size={14} />}>Scan barcode</Button>
            <Button variant="outline" size="sm" onClick={() => setTargetsOpen(true)} icon={<Calculator size={14} />}>Targets</Button>
          </>
        }
      />

      {/* Date nav */}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"
          className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2">
          <ChevronLeft size={17} />
        </button>
        <div className="text-center">
          <p className="font-semibold">{relativeDay(date)}</p>
          <p className="text-2xs text-ink-3">{formatDate(date, 'medium')}</p>
        </div>
        <button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today()} aria-label="Next day"
          className="h-9 w-9 grid place-items-center rounded-xl border border-line hover:bg-surface-2 disabled:opacity-30">
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="grid lg:grid-cols-[320px,1fr] gap-4">
        {/* Summary */}
        <aside className="space-y-3">
          <Card>
            <div className="p-5 text-center">
              <ProgressRing
                value={totals.calories} max={targets.calories} size={148} stroke={11}
                tone={totals.calories > targets.calories * 1.1 ? 'warn' : 'brand'}
                label={`${Math.round(totals.calories)} of ${targets.calories} calories`}
              >
                <span className="text-3xl font-black tabular leading-none">{Math.round(totals.calories)}</span>
                <span className="text-2xs text-ink-3 mt-1">of {formatNumber(targets.calories)} kcal</span>
              </ProgressRing>
              <p className="mt-3 text-sm text-ink-3">
                {targets.calories - totals.calories > 0
                  ? `${formatNumber(Math.round(targets.calories - totals.calories))} kcal remaining`
                  : `${formatNumber(Math.round(totals.calories - targets.calories))} kcal over target`}
              </p>
              <Badge tone="muted" size="sm" className="mt-2">Estimate</Badge>
            </div>

            <div className="px-5 pb-5 space-y-3">
              {macros.map((m) => (
                <div key={m.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-2">{m.label}</span>
                    <span className="tabular text-ink-3">{Math.round(m.value)} / {m.target} {m.unit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${Math.min(100, (m.value / (m.target || 1)) * 100)}%`, backgroundColor: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Eat for your goal */}
          <Card className="border-brand/30">
            <CardHeader title="Eat for your goal" subtitle={`You're ${GOAL_LABEL[goal]}`} dense icon={<Target size={16} className="text-brand-text" />} />
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-sm font-semibold leading-snug">{strategy.headline}</p>
              <p className="text-xs text-ink-3 leading-relaxed">{strategy.calorieStance}</p>
              <div className="rounded-xl bg-surface-2 border border-line p-3 text-sm space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-3 text-xs">Protein / day</span>
                  <span className="tabular font-bold text-xs">
                    {strategy.proteinPerDayG
                      ? `${strategy.proteinPerDayG[0]}–${strategy.proteinPerDayG[1]} g`
                      : `${strategy.proteinPerKg[0]}–${strategy.proteinPerKg[1]} g/kg`}
                  </span>
                </div>
                {strategy.perMealProteinG !== null && (
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-3 text-xs">Per meal, roughly</span>
                    <span className="tabular font-bold text-xs">~{strategy.perMealProteinG} g protein</span>
                  </div>
                )}
                {!strategy.proteinPerDayG && (
                  <p className="text-2xs text-ink-3 leading-relaxed">
                    Add your weight in your profile and this becomes grams per day.
                  </p>
                )}
              </div>
              <p className="text-2xs text-ink-3 leading-relaxed">{strategy.carbNote}</p>

              {date === today() && (
                suggestions.length > 0 ? (
                  <div>
                    <p className="text-2xs font-bold uppercase tracking-wide text-ink-3 mb-1.5">Good picks right now</p>
                    <ul className="space-y-2">
                      {suggestions.map((s) => (
                        <li key={s.food.name} className="text-xs leading-snug">
                          <p className="font-medium">{s.food.name}</p>
                          <p className="text-2xs text-ink-3">{s.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-2xs text-ink-3 leading-relaxed">
                    {remaining.overCalories
                      ? 'You are past today’s calorie target — nothing more to chase tonight. Tomorrow is a clean slate.'
                      : 'Today’s targets are essentially covered — no need to eat for the sake of it.'}
                  </p>
                )
              )}
              <p className="text-2xs text-ink-3 leading-relaxed border-t border-line pt-2">
                General fitness guidance from mainstream sports-nutrition ranges — not a prescription.
              </p>
            </div>
          </Card>

          {/* Water */}
          <Card>
            <CardHeader title="Water" dense icon={<Droplets size={16} className="text-info" />} />
            <div className="p-4 pt-2">
              {waterHabit ? (
                <>
                  <p className="text-2xl font-black tabular">
                    {formatNumber(waterValue)} <span className="text-sm text-ink-3 font-medium">/ {formatNumber(waterHabit.target)} ml</span>
                  </p>
                  <ProgressBar value={waterValue} max={waterHabit.target} tone="info" className="mt-2" />
                  <div className="mt-3 flex gap-2">
                    {[250, 500].map((ml) => (
                      <Button key={ml} variant="outline" size="sm" className="flex-1"
                        onClick={() => void logHabit(waterHabit.id, date, waterValue + ml)}>
                        +{ml} ml
                      </Button>
                    ))}
                    <Button variant="ghost" size="sm"
                      onClick={() => void logHabit(waterHabit.id, date, Math.max(0, waterValue - HABIT_STEP.ml))}
                      aria-label="Remove 250 ml">
                      −
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-3">
                  Turn on the water habit in <Link to="/habits" className="text-brand-text hover:underline">Healthy Habits</Link> to track hydration here.
                </p>
              )}
            </div>
          </Card>

          <Card className="border-warn/25">
            <div className="p-4">
              <p className="flex items-start gap-2 text-2xs text-ink-2 leading-relaxed">
                <Info size={13} className="shrink-0 mt-0.5 text-warn" />
                <span>
                  FitHub does not provide treatment for eating disorders or medical nutrition conditions.
                  For anything beyond general guidance, speak to a registered dietitian or your doctor.
                </span>
              </p>
            </div>
          </Card>
        </aside>

        {/* Meals */}
        <div className="space-y-3">
          {SLOTS.map((slot) => {
            const items = dayLogs.filter((n) => n.slot === slot.key);
            const slotCalories = items.reduce((a, n) => a + n.calories * n.servings, 0);
            return (
              <Card key={slot.key}>
                <CardHeader
                  title={<span className="flex items-center gap-2"><span aria-hidden>{slot.emoji}</span>{slot.label}</span>}
                  subtitle={items.length ? `${formatNumber(Math.round(slotCalories))} kcal` : 'Nothing logged'}
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setAdding(slot.key)} icon={<Plus size={14} />}>Add</Button>
                  }
                />
                {items.length > 0 && (
                  <ul className="divide-y divide-line">
                    {items.map((n) => (
                      <li key={n.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{n.name}</p>
                          <p className="text-2xs text-ink-3 tabular">
                            {n.servings !== 1 && `${n.servings} × `}
                            {Math.round(n.protein_g * n.servings)}p · {Math.round(n.carbs_g * n.servings)}c · {Math.round(n.fat_g * n.servings)}f
                          </p>
                        </div>
                        <span className="tabular font-semibold text-sm shrink-0">{Math.round(n.calories * n.servings)}</span>
                        <button type="button" onClick={() => void del('nutrition_logs', n.id)}
                          aria-label={`Remove ${n.name}`}
                          className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-danger shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          {dayLogs.length === 0 && (
            <Card>
              <EmptyState
                compact
                icon={<Apple size={20} />}
                title="Nothing logged for this day"
                body="Log what you actually eat, not what you meant to. The value is in the pattern over weeks."
              />
            </Card>
          )}
        </div>
      </div>

      {adding && (
        <FoodModal
          slot={adding}
          goal={goal}
          onScan={() => { const slot = adding; setAdding(null); setScanning(slot); }}
          onClose={() => setAdding(null)}
          onAdd={async (log) => {
            await addNutrition({ ...log, date });
            setAdding(null);
            toast.success('Logged', log.name);
          }}
        />
      )}

      {scanning && (
        <BarcodeScanner
          defaultSlot={scanning}
          onClose={() => setScanning(null)}
          onAdd={async (log) => {
            await addNutrition({ ...log, date });
            setScanning(null);
            toast.success('Logged from barcode', log.name);
          }}
        />
      )}

      {targetsOpen && (
        <Modal
          open onClose={() => setTargetsOpen(false)} title="Nutrition targets"
          description="These are estimates. If they do not match what you see in practice, change them."
          footer={
            <Button block onClick={() => { setTargetsOpen(false); toast.success('Targets saved'); }} icon={<Save size={15} />}>
              Done
            </Button>
          }
        >
          <div className="space-y-4">
            {estimated ? (
              <div className="p-4 rounded-2xl bg-surface-2 border border-line">
                <p className="text-sm font-semibold">FitHub's estimate</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-ink-3">Resting energy (BMR)</dt><dd className="tabular">{formatNumber(estimated.basal)} kcal</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-3">Maintenance (TDEE)</dt><dd className="tabular">{formatNumber(estimated.maintenance)} kcal</dd></div>
                  <div className="flex justify-between font-semibold"><dt>Suggested daily intake</dt><dd className="tabular">{formatNumber(estimated.calories)} kcal</dd></div>
                </dl>
                <Button
                  size="sm" variant="outline" className="mt-3"
                  onClick={() => void put('nutrition_targets', {
                    ...targets,
                    calories: estimated.calories, protein_g: estimated.protein,
                    carbs_g: estimated.carbs, fat_g: estimated.fat, manual: false,
                  })}
                >
                  Use this estimate
                </Button>
                <p className="mt-2 text-2xs text-ink-3 leading-relaxed">
                  Based on Mifflin–St Jeor and your training frequency. Individual needs vary by 10–15%
                  or more — treat it as a starting point, not a prescription.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-3">
                Add your height, weight and date of birth in your profile to see an estimated target.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input label="Calories (kcal)" type="number" inputMode="numeric" value={targets.calories}
                onChange={(e) => void put('nutrition_targets', { ...targets, calories: Number(e.target.value) || 0, manual: true })} />
              <Input label="Protein (g)" type="number" inputMode="numeric" value={targets.protein_g}
                onChange={(e) => void put('nutrition_targets', { ...targets, protein_g: Number(e.target.value) || 0, manual: true })} />
              <Input label="Carbs (g)" type="number" inputMode="numeric" value={targets.carbs_g}
                onChange={(e) => void put('nutrition_targets', { ...targets, carbs_g: Number(e.target.value) || 0, manual: true })} />
              <Input label="Fat (g)" type="number" inputMode="numeric" value={targets.fat_g}
                onChange={(e) => void put('nutrition_targets', { ...targets, fat_g: Number(e.target.value) || 0, manual: true })} />
            </div>

            <Toggle
              checked={targets.manual}
              onChange={(v) => void put('nutrition_targets', { ...targets, manual: v })}
              label="I set these myself"
              description="When off, FitHub may refresh the estimate as your weight and training change."
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function FoodModal({ slot, goal, onScan, onClose, onAdd }: {
  slot: MealSlot;
  goal: GoalKind;
  onScan: () => void;
  onClose: () => void;
  onAdd: (log: Omit<NutritionLog, 'id' | 'user_id' | 'created_at' | 'date'>) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(false);
  const [servings, setServings] = useState('1');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [manual, setManual] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  const results = useMemo(() => FOODS.filter((f) => matches(f.name, query) || f.tags.some((t) => matches(t, query))), [query]);
  const n = Math.max(0.25, Number(servings) || 1);

  return (
    <Modal
      open onClose={onClose}
      title={`Add to ${SLOTS.find((s) => s.key === slot)?.label.toLowerCase()}`}
      size="md"
      footer={
        <Button
          block
          disabled={custom ? !manual.name.trim() : !selected}
          onClick={() => {
            if (custom) {
              void onAdd({
                slot, name: manual.name.trim(), servings: n,
                calories: Number(manual.calories) || 0,
                protein_g: Number(manual.protein) || 0,
                carbs_g: Number(manual.carbs) || 0,
                fat_g: Number(manual.fat) || 0,
              });
            } else if (selected) {
              void onAdd({
                slot, name: `${selected.name} (${selected.serving})`, servings: n,
                calories: selected.calories, protein_g: selected.protein_g,
                carbs_g: selected.carbs_g, fat_g: selected.fat_g,
              });
            }
          }}
        >
          Add to log
        </Button>
      }
    >
      <div className="flex gap-2 mb-3">
        <Button variant={custom ? 'ghost' : 'secondary'} size="sm" className="flex-1" onClick={() => setCustom(false)}>Search foods</Button>
        <Button variant={custom ? 'secondary' : 'ghost'} size="sm" className="flex-1" onClick={() => setCustom(true)}>Custom entry</Button>
        <Button variant="ghost" size="sm" onClick={onScan} icon={<ScanBarcode size={14} />}>Scan</Button>
      </div>

      {custom ? (
        <div className="space-y-3">
          <Input label="Name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="e.g. Homemade chilli" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Calories" type="number" inputMode="numeric" value={manual.calories} onChange={(e) => setManual({ ...manual, calories: e.target.value })} />
            <Input label="Protein (g)" type="number" inputMode="decimal" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} />
            <Input label="Carbs (g)" type="number" inputMode="decimal" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} />
            <Input label="Fat (g)" type="number" inputMode="decimal" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} />
          </div>
        </div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods…" prefix={<Search size={15} />} aria-label="Search foods" autoFocus />
          <ul className="mt-3 space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
            {results.length === 0 && <li className="py-8 text-center text-sm text-ink-3">No match — use a custom entry.</li>}
            {results.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  onClick={() => setSelected(f)}
                  aria-pressed={selected?.name === f.name}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                    selected?.name === f.name ? 'border-brand bg-brand-soft/40' : 'border-line hover:border-line-strong',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-2xs text-ink-3 tabular">
                      {f.serving} · {f.protein_g}p · {f.carbs_g}c · {f.fat_g}f
                    </p>
                  </div>
                  <span className="tabular font-semibold text-sm shrink-0">{f.calories}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && <FoodIQPanel food={selected} goal={goal} />}
        </>
      )}

      <div className="mt-4 flex items-end gap-3">
        <Input label="Servings" type="number" inputMode="decimal" step="0.25" min="0.25" value={servings}
          onChange={(e) => setServings(e.target.value)} className="w-32" />
        {(selected || custom) && (
          <p className="text-sm text-ink-3 pb-2.5 tabular">
            = {Math.round((custom ? Number(manual.calories) || 0 : selected?.calories ?? 0) * n)} kcal
          </p>
        )}
      </div>

      <p className="mt-3 text-2xs text-ink-3 leading-relaxed">
        Values are approximate and vary by brand and preparation. Consistency matters more than precision.
      </p>
    </Modal>
  );
}

/** What the selected food does for you, scored against the goal you actually train for. */
function FoodIQPanel({ food, goal }: { food: FoodItem; goal: GoalKind }) {
  const fit = goalFit(food, goal);
  const benefits = foodBenefits(food).slice(0, 2);
  return (
    <div className="mt-3 rounded-xl border border-line bg-surface-2/60 p-3.5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-3 inline-flex items-center gap-1.5">
          <Sparkles size={12} className="text-brand-text" /> Food IQ
        </p>
        <Badge
          tone={fit.band === 'strong' ? 'brand' : fit.band === 'solid' ? 'success' : 'muted'}
          size="sm"
        >
          {GOAL_FIT_META[fit.band].label} for {GOAL_LABEL[goal]}
        </Badge>
      </div>
      <ul className="mt-2 space-y-1.5">
        {benefits.map((b) => (
          <li key={b.title} className="text-xs leading-relaxed">
            <span className="font-semibold">{b.title}.</span>{' '}
            <span className="text-ink-3">{b.detail}</span>
          </li>
        ))}
        {fit.reasons[0] && (
          <li className="text-xs leading-relaxed text-ink-3">{fit.reasons[0]}</li>
        )}
      </ul>
    </div>
  );
}
