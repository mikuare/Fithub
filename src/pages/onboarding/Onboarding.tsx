import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, Dumbbell, Home, Trees, Shuffle, Building2,
  Flame, TrendingUp, HeartPulse, Sparkles, Activity, Anchor, AlertTriangle, Info,
} from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, ChoiceCard, Select, Textarea, Checkbox, Label } from '@/components/ui/Field';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { emptyFitnessProfile, HEALTH_DISCLAIMER } from '@/lib/defaults';
import { generateProgram } from '@/lib/fitness/program';
import { habitsFromTemplates, HABIT_TEMPLATES } from '@/data/habits';
import { buildMilestones } from '@/lib/fitness/goals';
import { EQUIPMENT_LABEL, EQUIPMENT_OPTIONS } from '@/data/exercises';
import { inputWeightToKg, inputLengthToCm, displayWeight, displayLength, weightUnit, lengthUnit } from '@/lib/fitness/units';
import { uid } from '@/lib/id';
import { addDays, DAY_SHORT, nowISO, today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import type {
  Activity as ActivityKind, Equipment, Experience, FitnessProfile, Gender,
  GoalKind, TrainingLocation, Units, Weekday, Goal,
} from '@/types';

/* ------------------------------------------------------------------ */

const STEPS = [
  { key: 'about', title: 'About you', blurb: 'The basics FitHub needs to personalise anything.' },
  { key: 'experience', title: 'Experience', blurb: 'This sets exercise difficulty and starting volume.' },
  { key: 'goal', title: 'Your goal', blurb: 'One primary goal drives your programme structure.' },
  { key: 'where', title: 'Where you train', blurb: 'So you are never given equipment you do not have.' },
  { key: 'equipment', title: 'Equipment', blurb: 'Only what you can actually use.' },
  { key: 'schedule', title: 'Availability', blurb: 'A realistic schedule beats an ambitious one.' },
  { key: 'likes', title: 'What you enjoy', blurb: 'Training you like is training you repeat.' },
  { key: 'safety', title: 'Safety screening', blurb: 'A few questions so FitHub can train around limitations.' },
  { key: 'habits', title: 'Daily habits', blurb: 'Optional. Pick only what you will actually track.' },
  { key: 'review', title: 'Review', blurb: 'Confirm and build your programme.' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const GOALS: Array<{ value: GoalKind; title: string; description: string; icon: typeof Flame }> = [
  { value: 'lose_fat', title: 'Lose body fat', description: 'Resistance training to keep muscle, plus regular conditioning.', icon: Flame },
  { value: 'build_muscle', title: 'Build muscle', description: 'Moderate reps, progressive load, enough volume per muscle group.', icon: Dumbbell },
  { value: 'gain_strength', title: 'Gain strength', description: 'Heavier compound lifts, lower reps, longer rest periods.', icon: TrendingUp },
  { value: 'improve_endurance', title: 'Improve endurance', description: 'Cardio-led programming with supporting strength work.', icon: HeartPulse },
  { value: 'general_fitness', title: 'Improve general fitness', description: 'A balanced mix of strength, cardio and mobility.', icon: Activity },
  { value: 'mobility', title: 'Improve mobility', description: 'Range-of-motion work plus strength through that new range.', icon: Sparkles },
  { value: 'maintain', title: 'Maintain current fitness', description: 'Efficient sessions that hold what you have built.', icon: Anchor },
];

const LOCATIONS: Array<{ value: TrainingLocation; title: string; description: string; icon: typeof Home }> = [
  { value: 'gym', title: 'Commercial gym', description: 'Full range of machines, racks and free weights.', icon: Building2 },
  { value: 'home_gym', title: 'Home gym', description: 'A dedicated space with your own equipment.', icon: Home },
  { value: 'home_minimal', title: 'Home, minimal equipment', description: 'A mat, maybe some dumbbells or bands.', icon: Home },
  { value: 'outdoor', title: 'Outdoors', description: 'Parks, trails, calisthenics bars.', icon: Trees },
  { value: 'mixed', title: 'A mix', description: 'Gym some days, home or outdoors on others.', icon: Shuffle },
];

const LOCATION_EQUIPMENT: Record<TrainingLocation, Equipment[]> = {
  gym: ['bodyweight', 'dumbbells', 'barbell', 'bench', 'squat_rack', 'cable', 'machine', 'smith', 'kettlebell', 'treadmill', 'bike', 'rower', 'elliptical', 'pullup_bar', 'dip_bars', 'mat'],
  home_gym: ['bodyweight', 'dumbbells', 'barbell', 'bench', 'squat_rack', 'kettlebell', 'bands', 'pullup_bar', 'mat'],
  home_minimal: ['bodyweight', 'bands', 'dumbbells', 'mat'],
  outdoor: ['bodyweight', 'pullup_bar', 'dip_bars', 'jump_rope'],
  mixed: ['bodyweight', 'dumbbells', 'bands', 'bench', 'pullup_bar', 'mat'],
};

const ACTIVITIES: Array<{ value: ActivityKind; label: string; icon: string }> = [
  { value: 'weightlifting', label: 'Weightlifting', icon: '🏋️' },
  { value: 'calisthenics', label: 'Calisthenics', icon: '🤸' },
  { value: 'running', label: 'Running', icon: '🏃' },
  { value: 'walking', label: 'Walking', icon: '🚶' },
  { value: 'cycling', label: 'Cycling', icon: '🚴' },
  { value: 'swimming', label: 'Swimming', icon: '🏊' },
  { value: 'hiit', label: 'HIIT', icon: '⚡' },
  { value: 'yoga', label: 'Yoga', icon: '🧘' },
  { value: 'mobility', label: 'Mobility', icon: '🤾' },
  { value: 'sports', label: 'Sports', icon: '⚽' },
];

/* ------------------------------------------------------------------ */

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const put = useData((s) => s.put);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FitnessProfile>(() =>
    emptyFitnessProfile(profile?.id ?? '', profile?.full_name.split(' ')[0] ?? ''),
  );
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [habitKeys, setHabitKeys] = useState<string[]>(HABIT_TEMPLATES.filter((h) => h.defaultOn).map((h) => h.key));

  const step = STEPS[stepIndex];
  const patch = (p: Partial<FitnessProfile>) => setForm((f) => ({ ...f, ...p }));

  const errors = useMemo(() => validate(step.key, form), [step.key, form]);
  const canContinue = errors.length === 0;

  const onUnitsChange = (units: Units) => {
    // Re-render the typed values in the new unit rather than silently changing meaning.
    if (form.height_cm !== null) setHeightInput(String(displayLength(form.height_cm, units, 1) ?? ''));
    if (form.weight_kg !== null) setWeightInput(String(displayWeight(form.weight_kg, units, 1) ?? ''));
    patch({ units });
  };

  const next = () => {
    if (!canContinue) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const back = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const finish = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const fitnessProfile: FitnessProfile = { ...form, user_id: profile.id, updated_at: nowISO() };
      await put('fitness_profiles', fitnessProfile);

      const program = generateProgram(fitnessProfile, profile.id);
      await put('programs', program);

      for (const habit of habitsFromTemplates(profile.id, habitKeys)) await put('habit_definitions', habit);

      const starterGoal = buildStarterGoal(fitnessProfile, profile.id);
      if (starterGoal) await put('goals', starterGoal);

      await updateProfile({ onboarded: true });
      toast.success('Your programme is ready', `${program.split} — ${program.days_per_week} days a week.`);
      navigate('/assessment', { replace: true });
    } catch {
      toast.error('Could not save your profile', 'Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-line sticky top-0 z-20 glass">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
          <Logo />
          <span className="font-bold tracking-tight">FitHub</span>
          <span className="flex-1" />
          <span className="text-sm text-ink-3 tabular">Step {stepIndex + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1 bg-surface-2">
          <div
            className="h-full bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label="Onboarding progress"
          />
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-text">{step.title}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">{headingFor(step.key, form)}</h1>
        <p className="mt-2 text-sm text-ink-3 leading-relaxed">{step.blurb}</p>

        <div className="mt-8">
          {step.key === 'about' && (
            <div className="space-y-5">
              <Input
                label="What should we call you?" required value={form.first_name}
                onChange={(e) => patch({ first_name: e.target.value })}
                placeholder="Alex" inputSize="lg" autoComplete="given-name"
              />

              <div>
                <Label>Gender</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['male', 'Male'], ['female', 'Female'],
                    ['other', 'Other'], ['prefer_not_to_say', 'Prefer not to say'],
                  ] as Array<[Gender, string]>).map(([value, label]) => (
                    <ChoiceCard key={value} selected={form.gender === value} onSelect={() => patch({ gender: value })} title={label} />
                  ))}
                </div>
                <p className="mt-2 text-2xs text-ink-3">
                  Used only to estimate energy expenditure. "Prefer not to say" uses a midpoint rather than assuming.
                </p>
              </div>

              <div>
                <Label>Measurement units</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceCard selected={form.units === 'metric'} onSelect={() => onUnitsChange('metric')} title="Metric" description="kg · cm · km" />
                  <ChoiceCard selected={form.units === 'imperial'} onSelect={() => onUnitsChange('imperial')} title="Imperial" description="lb · in · mi" />
                </div>
              </div>

              <Input
                label="Date of birth" type="date" value={form.birth_date ?? ''}
                onChange={(e) => patch({ birth_date: e.target.value || null })}
                hint="Optional — improves calorie and heart-rate zone estimates."
                max={today()} inputSize="lg"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={`Height (${lengthUnit(form.units)})`} type="number" inputMode="decimal" step="0.1"
                  value={heightInput}
                  onChange={(e) => {
                    setHeightInput(e.target.value);
                    const n = Number(e.target.value);
                    patch({ height_cm: e.target.value && Number.isFinite(n) ? inputLengthToCm(n, form.units) : null });
                  }}
                  placeholder={form.units === 'metric' ? '175' : '69'} inputSize="lg" hint="Optional"
                />
                <Input
                  label={`Weight (${weightUnit(form.units)})`} type="number" inputMode="decimal" step="0.1"
                  value={weightInput}
                  onChange={(e) => {
                    setWeightInput(e.target.value);
                    const n = Number(e.target.value);
                    patch({ weight_kg: e.target.value && Number.isFinite(n) ? inputWeightToKg(n, form.units) : null });
                  }}
                  placeholder={form.units === 'metric' ? '75' : '165'} inputSize="lg" hint="Optional"
                />
              </div>
            </div>
          )}

          {step.key === 'experience' && (
            <div className="space-y-2.5">
              {([
                ['beginner', 'Beginner', 'New to structured training, or returning after a long break. Fewer sets, simpler movements, more guidance.'],
                ['intermediate', 'Intermediate', 'Six months or more of consistent training. Comfortable with the main lifts.'],
                ['advanced', 'Advanced', 'Years of consistent training. Higher volume and more demanding movement selection.'],
              ] as Array<[Experience, string, string]>).map(([value, title, description]) => (
                <ChoiceCard
                  key={value}
                  selected={form.experience === value}
                  onSelect={() => patch({ experience: value })}
                  title={title}
                  description={description}
                />
              ))}
              <Callout>
                Choosing "beginner" is not a limitation — it is the fastest route to progress. FitHub raises
                difficulty as your logged sessions show you are ready.
              </Callout>
            </div>
          )}

          {step.key === 'goal' && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                {GOALS.map((g) => (
                  <ChoiceCard
                    key={g.value}
                    selected={form.primary_goal === g.value}
                    onSelect={() => patch({ primary_goal: g.value, secondary_goals: form.secondary_goals.filter((s) => s !== g.value) })}
                    title={g.title}
                    description={g.description}
                    icon={<g.icon size={18} />}
                  />
                ))}
              </div>
              <div>
                <Label hint="Optional. These influence exercise selection but not the overall structure.">Secondary goals</Label>
                <div className="flex flex-wrap gap-2">
                  {GOALS.filter((g) => g.value !== form.primary_goal).map((g) => {
                    const on = form.secondary_goals.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          patch({
                            secondary_goals: on
                              ? form.secondary_goals.filter((s) => s !== g.value)
                              : [...form.secondary_goals, g.value].slice(0, 2),
                          })
                        }
                        className={cn(
                          'px-3 h-9 rounded-xl border text-sm font-medium transition-colors',
                          on ? 'bg-brand-soft border-brand/40 text-brand-text' : 'border-line text-ink-2 hover:border-line-strong',
                        )}
                      >
                        {g.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step.key === 'where' && (
            <div className="space-y-2.5">
              {LOCATIONS.map((l) => (
                <ChoiceCard
                  key={l.value}
                  selected={form.location === l.value}
                  onSelect={() => patch({ location: l.value, equipment: LOCATION_EQUIPMENT[l.value] })}
                  title={l.title}
                  description={l.description}
                  icon={<l.icon size={18} />}
                />
              ))}
              <Callout>Picking a location pre-selects the usual equipment. You can adjust it on the next step.</Callout>
            </div>
          )}

          {step.key === 'equipment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EQUIPMENT_OPTIONS.map((eq) => {
                  const on = form.equipment.includes(eq);
                  const locked = eq === 'bodyweight';
                  return (
                    <button
                      key={eq}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      disabled={locked}
                      onClick={() =>
                        patch({ equipment: on ? form.equipment.filter((e) => e !== eq) : [...form.equipment, eq] })
                      }
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border text-sm font-medium text-left transition-all',
                        on ? 'bg-brand-soft border-brand/40 text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong',
                        locked && 'opacity-80 cursor-default',
                      )}
                    >
                      <span
                        className={cn('shrink-0 h-4.5 w-4.5 rounded-md border grid place-items-center', on ? 'bg-brand border-brand' : 'border-line-strong')}
                        style={{ width: 18, height: 18 }}
                        aria-hidden
                      >
                        {on && <Check size={11} strokeWidth={3.5} className="text-brand-contrast" />}
                      </span>
                      <span className="truncate">{EQUIPMENT_LABEL[eq] ?? eq}</span>
                    </button>
                  );
                })}
              </div>
              <Callout>
                Bodyweight is always available. FitHub will never prescribe an exercise that needs
                equipment you have not selected here — and once you are set up, every piece you tick
                gets its own how-to guide under My&nbsp;Equipment.
              </Callout>
            </div>
          )}

          {step.key === 'schedule' && (
            <div className="space-y-6">
              <div>
                <Label required>Days available per week</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={form.days_per_week === n}
                      onClick={() => patch({ days_per_week: n, preferred_days: form.preferred_days.slice(0, n) })}
                      className={cn(
                        'flex-1 h-12 rounded-xl border font-bold tabular transition-all active:scale-95',
                        form.days_per_week === n
                          ? 'bg-brand text-brand-contrast border-brand'
                          : 'bg-surface-2 border-line text-ink-2 hover:border-line-strong',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-2xs text-ink-3">
                  {form.days_per_week <= 2 && 'Two quality sessions a week is enough to make real progress.'}
                  {form.days_per_week === 3 && 'Three days is the sweet spot for most people.'}
                  {form.days_per_week >= 4 && form.days_per_week <= 5 && 'A strong commitment — make sure rest days stay rest days.'}
                  {form.days_per_week >= 6 && 'High frequency. FitHub will build in recovery work to keep it sustainable.'}
                </p>
              </div>

              <div>
                <Label hint="Optional. Leave blank and FitHub will space your sessions evenly.">Preferred training days</Label>
                <div className="flex gap-1.5">
                  {DAY_SHORT.map((label, i) => {
                    const day = i as Weekday;
                    const on = form.preferred_days.includes(day);
                    const full = form.preferred_days.length >= form.days_per_week && !on;
                    return (
                      <button
                        key={label + i}
                        type="button"
                        aria-pressed={on}
                        aria-label={label}
                        disabled={full}
                        onClick={() =>
                          patch({
                            preferred_days: on
                              ? form.preferred_days.filter((d) => d !== day)
                              : [...form.preferred_days, day].sort((a, b) => a - b),
                          })
                        }
                        className={cn(
                          'flex-1 h-11 rounded-xl border text-xs font-semibold transition-all disabled:opacity-35',
                          on ? 'bg-brand text-brand-contrast border-brand' : 'bg-surface-2 border-line text-ink-2 hover:border-line-strong',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-2xs text-ink-3 tabular">
                  {form.preferred_days.length} of {form.days_per_week} selected
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Preferred time" type="time" value={form.preferred_time}
                  onChange={(e) => patch({ preferred_time: e.target.value })} inputSize="lg"
                  hint="Used for workout reminders."
                />
                <Select
                  label="Session length"
                  value={String(form.session_minutes)}
                  onChange={(e) => patch({ session_minutes: Number(e.target.value) })}
                  options={[20, 30, 45, 60, 75, 90].map((m) => ({ value: String(m), label: `${m} minutes` }))}
                  hint="Sessions are built to fit this."
                />
              </div>
            </div>
          )}

          {step.key === 'likes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACTIVITIES.map((a) => {
                  const on = form.activities.includes(a.value);
                  return (
                    <button
                      key={a.value}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        patch({ activities: on ? form.activities.filter((x) => x !== a.value) : [...form.activities, a.value] })
                      }
                      className={cn(
                        'flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border transition-all active:scale-95',
                        on ? 'bg-brand-soft border-brand/40' : 'border-line bg-surface hover:border-line-strong',
                      )}
                    >
                      <span className="text-2xl" aria-hidden>{a.icon}</span>
                      <span className={cn('text-xs font-medium', on ? 'text-ink' : 'text-ink-2')}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
              <Callout>Optional — but picking a few makes your cardio and conditioning days far more likely to stick.</Callout>
            </div>
          )}

          {step.key === 'safety' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl border border-warn/30 bg-warn-soft">
                <p className="flex items-start gap-2.5 text-sm text-ink-2 leading-relaxed">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-warn" />
                  <span>
                    FitHub does not diagnose anything. These answers only change which exercises are
                    suggested and what safety guidance is shown.
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <YesNo
                  label="Do you ever experience chest pain or pressure during exercise?"
                  value={form.safety.chest_pain}
                  onChange={(v) => patch({ safety: { ...form.safety, chest_pain: v } })}
                />
                <YesNo
                  label="Do you experience dizziness or light-headedness during exercise?"
                  value={form.safety.dizziness}
                  onChange={(v) => patch({ safety: { ...form.safety, dizziness: v } })}
                />
                <YesNo
                  label="Are you recovering from surgery or a recent injury?"
                  value={form.safety.recent_surgery}
                  onChange={(v) => patch({ safety: { ...form.safety, recent_surgery: v } })}
                />
              </div>

              <Textarea
                label="Existing injuries" placeholder="e.g. Left shoulder impingement, ongoing"
                value={form.safety.injuries}
                onChange={(e) => patch({ safety: { ...form.safety, injuries: e.target.value } })}
                hint="Optional. Shown alongside relevant exercises so you can swap them."
              />
              <Textarea
                label="Movement limitations" placeholder="e.g. Cannot press overhead without pain"
                value={form.safety.movement_limitations}
                onChange={(e) => patch({ safety: { ...form.safety, movement_limitations: e.target.value } })}
                hint="Optional."
              />
              <Textarea
                label="Exercises a doctor told you to avoid" placeholder="e.g. No loaded spinal flexion"
                value={form.safety.doctor_restrictions}
                onChange={(e) => patch({ safety: { ...form.safety, doctor_restrictions: e.target.value } })}
                hint="Optional."
              />

              {isFlagged(form) && (
                <div className="p-4 rounded-2xl border border-danger/40 bg-danger-soft" role="alert">
                  <p className="font-semibold text-sm text-danger flex items-center gap-2">
                    <AlertTriangle size={16} /> Please read before you start
                  </p>
                  <p className="mt-2 text-sm text-ink-2 leading-relaxed">
                    Based on your answers, consider consulting a qualified healthcare professional before
                    starting or significantly changing your exercise programme. FitHub will keep your
                    programme conservative and skip advanced movements in the meantime.
                  </p>
                  <div className="mt-3">
                    <Checkbox
                      checked={form.safety.acknowledged_at !== null}
                      onChange={(v) => patch({ safety: { ...form.safety, acknowledged_at: v ? nowISO() : null } })}
                      label="I have read this and understand FitHub is not medical advice."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step.key === 'habits' && (
            <div className="space-y-2.5">
              {HABIT_TEMPLATES.map((h) => (
                <ChoiceCard
                  key={h.key}
                  multi
                  selected={habitKeys.includes(h.key)}
                  onSelect={() =>
                    setHabitKeys((keys) => (keys.includes(h.key) ? keys.filter((k) => k !== h.key) : [...keys, h.key]))
                  }
                  title={h.name}
                  description={h.blurb}
                />
              ))}
              <Callout>
                Tracking every habit at once is the fastest way to track none of them. Two or three is plenty
                to start — you can add more any time.
              </Callout>
            </div>
          )}

          {step.key === 'review' && (
            <ReviewStep form={form} habitKeys={habitKeys} onJump={setStepIndex} />
          )}
        </div>

        {errors.length > 0 && (
          <ul className="mt-5 space-y-1" role="alert">
            {errors.map((e) => (
              <li key={e} className="text-xs text-danger flex items-center gap-1.5"><AlertTriangle size={13} /> {e}</li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex items-center gap-3">
          {stepIndex > 0 && (
            <Button variant="ghost" size="lg" onClick={back} icon={<ArrowLeft size={17} />}>Back</Button>
          )}
          <span className="flex-1" />
          {stepIndex < STEPS.length - 1 ? (
            <Button size="lg" onClick={next} disabled={!canContinue} iconRight={<ArrowRight size={17} />}>
              Continue
            </Button>
          ) : (
            <Button size="lg" onClick={() => void finish()} loading={saving} iconRight={<ArrowRight size={17} />}>
              Build my programme
            </Button>
          )}
        </div>

        <p className="mt-10 text-2xs text-ink-3 leading-relaxed border-t border-line pt-5">{HEALTH_DISCLAIMER}</p>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function headingFor(key: StepKey, form: FitnessProfile): string {
  const name = form.first_name.trim();
  switch (key) {
    case 'about': return 'Let’s start with the basics';
    case 'experience': return `Where are you right now${name ? `, ${name}` : ''}?`;
    case 'goal': return 'What matters most to you?';
    case 'where': return 'Where will you train?';
    case 'equipment': return 'What can you actually use?';
    case 'schedule': return 'When can you train?';
    case 'likes': return 'What do you enjoy?';
    case 'safety': return 'A few safety questions';
    case 'habits': return 'Anything you want to build?';
    case 'review': return 'Ready to build your programme';
  }
}

function validate(key: StepKey, form: FitnessProfile): string[] {
  const errors: string[] = [];
  if (key === 'about' && form.first_name.trim().length < 1) errors.push('Enter a name so FitHub can address you.');
  if (key === 'equipment' && form.equipment.length === 0) errors.push('Select at least one equipment option.');
  if (key === 'schedule' && form.preferred_days.length > form.days_per_week) {
    errors.push('You have selected more preferred days than sessions per week.');
  }
  if (key === 'safety' && isFlagged(form) && form.safety.acknowledged_at === null) {
    errors.push('Please confirm you have read the safety notice.');
  }
  return errors;
}

function isFlagged(form: FitnessProfile): boolean {
  return form.safety.chest_pain || form.safety.dizziness || form.safety.recent_surgery;
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-line bg-surface">
      <span className="text-sm text-ink-2 leading-snug">{label}</span>
      <div className="flex gap-1.5 shrink-0" role="group" aria-label={label}>
        {[['No', false], ['Yes', true]].map(([text, v]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v as boolean)}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-semibold border transition-colors',
              value === v
                ? (v ? 'bg-warn text-white border-warn' : 'bg-brand text-brand-contrast border-brand')
                : 'border-line text-ink-3 hover:border-line-strong',
            )}
          >
            {text as string}
          </button>
        ))}
      </div>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 p-3.5 rounded-xl bg-surface-2 border border-line text-xs text-ink-2 leading-relaxed">
      <Info size={14} className="shrink-0 mt-0.5 text-ink-3" />
      <span>{children}</span>
    </p>
  );
}

function ReviewStep({ form, habitKeys, onJump }: { form: FitnessProfile; habitKeys: string[]; onJump: (i: number) => void }) {
  const preview = useMemo(() => generateProgram(form, 'preview', { seed: 42 }), [form]);
  const rows: Array<[string, string, number]> = [
    ['Name', form.first_name || '—', 0],
    ['Experience', form.experience, 1],
    ['Primary goal', GOALS.find((g) => g.value === form.primary_goal)?.title ?? '—', 2],
    ['Training location', LOCATIONS.find((l) => l.value === form.location)?.title ?? '—', 3],
    ['Equipment', `${form.equipment.length} items selected`, 4],
    ['Schedule', `${form.days_per_week}× per week · ${form.session_minutes} min`, 5],
    ['Enjoys', form.activities.length ? form.activities.length + ' activities' : 'Not specified', 6],
    ['Habits to track', habitKeys.length ? `${habitKeys.length} selected` : 'None', 8],
  ];

  return (
    <div className="space-y-5">
      <div className="card divide-y divide-line">
        {rows.map(([label, value, index]) => (
          <button
            key={label}
            type="button"
            onClick={() => onJump(index)}
            className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-2 transition-colors"
          >
            <span className="text-sm text-ink-3">{label}</span>
            <span className="text-sm font-medium capitalize text-right">{value}</span>
          </button>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-text">Your programme preview</p>
        <h3 className="mt-2 font-bold text-lg">{preview.split}</h3>
        <p className="mt-1.5 text-sm text-ink-3 leading-relaxed">{preview.notes}</p>
        <ul className="mt-4 space-y-1.5">
          {preview.days.map((d) => (
            <li key={d.id} className="flex items-center gap-3 text-sm">
              <span className="w-9 text-2xs font-semibold uppercase text-ink-3">{DAY_SHORT[d.weekday]}</span>
              <span className={cn('flex-1 font-medium', d.kind === 'rest' && 'text-ink-3')}>{d.title}</span>
              {d.exercises.length > 0 && (
                <span className="text-2xs text-ink-3 tabular">{d.exercises.length} exercises · {d.est_minutes} min</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-2xs text-ink-3">You can regenerate or hand-edit any of this afterwards.</p>
      </div>
    </div>
  );
}

/** Creates a first measurable goal that matches the user's stated intent. */
function buildStarterGoal(profile: FitnessProfile, userId: string): Goal | null {
  const start = today();
  const target_date = addDays(start, 84); // 12 weeks
  const base = {
    id: uid('goal'), user_id: userId, ref: null as string | null,
    start_date: start, target_date, status: 'starting' as const,
    achieved_at: null, archived: false, created_at: nowISO(),
  };

  if (profile.primary_goal === 'lose_fat' && profile.weight_kg) {
    const target = Math.round((profile.weight_kg - Math.min(6, profile.weight_kg * 0.07)) * 10) / 10;
    return {
      ...base,
      title: `Reach ${target} kg`,
      metric: 'body_weight', unit: 'kg',
      start_value: profile.weight_kg, target_value: target, current_value: profile.weight_kg,
      direction: 'decrease',
      milestones: buildMilestones(profile.weight_kg, target, 'kg'),
    };
  }

  if (profile.primary_goal === 'improve_endurance') {
    return {
      ...base,
      title: 'Run 5 km continuously',
      metric: 'run_distance', unit: 'km',
      start_value: 0, target_value: 5, current_value: 0, direction: 'increase',
      milestones: buildMilestones(0, 5, 'km'),
    };
  }

  // Everything else starts with the habit that actually drives results.
  return {
    ...base,
    title: `Complete ${profile.days_per_week} workouts every week`,
    metric: 'workouts_per_week', unit: 'sessions',
    start_value: 0, target_value: profile.days_per_week, current_value: 0, direction: 'increase',
    milestones: buildMilestones(0, profile.days_per_week, 'sessions', Math.max(2, profile.days_per_week)),
  };
}
