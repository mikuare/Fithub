import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, SkipForward, Info, Ruler, HeartPulse, Timer, Activity } from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, Label, ScaleInput } from '@/components/ui/Field';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { uid } from '@/lib/id';
import { nowISO, today } from '@/lib/date';
import { inputLengthToCm, inputWeightToKg, lengthUnit, weightUnit } from '@/lib/fitness/units';
import { bmi, bmiBand } from '@/lib/fitness/calculations';
import { toast } from '@/store/toast';
import { cn } from '@/lib/utils';
import type { Assessment } from '@/types';

type Section = 'body' | 'measurements' | 'performance' | 'done';

/**
 * FitStart — an optional baseline. Every field can be skipped; the point is to
 * have *something* to compare against later, not to make people measure parts
 * of their body they would rather not think about.
 */
export default function FitStart() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useAuth();
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const put = useData((s) => s.put);
  const saveMeasurement = useData((s) => s.saveMeasurement);
  const [section, setSection] = useState<Section>('body');
  const [saving, setSaving] = useState(false);
  const units = fitnessProfile?.units ?? 'metric';

  const [values, setValues] = useState<Record<string, string>>({});
  const [mobility, setMobility] = useState<number | null>(null);

  const num = (key: string): number | null => {
    const raw = values[key];
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));

  const weightKg = num('weight') !== null ? inputWeightToKg(num('weight')!, units) : null;
  const bmiValue = bmi(weightKg, fitnessProfile?.height_cm ?? null);
  const band = bmiBand(bmiValue);

  const lenToCm = (key: string) => (num(key) !== null ? inputLengthToCm(num(key)!, units) : null);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const assessment: Assessment = {
        id: uid('asmt'),
        user_id: profile.id,
        taken_at: nowISO(),
        weight_kg: weightKg,
        waist_cm: lenToCm('waist'),
        chest_cm: lenToCm('chest'),
        arm_cm: lenToCm('arm'),
        thigh_cm: lenToCm('thigh'),
        hip_cm: lenToCm('hip'),
        resting_hr: num('rhr'),
        pushups: num('pushups'),
        plank_seconds: num('plank'),
        squats_60s: num('squats'),
        endurance_minutes: num('endurance_min'),
        endurance_distance_km: num('endurance_km'),
        mobility_score: mobility,
        notes: '',
      };
      await put('assessments', assessment);

      // A baseline is also the first point on the body-progress chart.
      if (weightKg || assessment.waist_cm || assessment.chest_cm) {
        await saveMeasurement({
          date: today(),
          weight_kg: weightKg,
          body_fat_pct: null,
          waist_cm: assessment.waist_cm,
          chest_cm: assessment.chest_cm,
          arm_cm: assessment.arm_cm,
          thigh_cm: assessment.thigh_cm,
          hip_cm: assessment.hip_cm,
          neck_cm: null,
          note: 'FitStart baseline',
        });
      }

      if (fitnessProfile && weightKg && !fitnessProfile.weight_kg) {
        await put('fitness_profiles', { ...fitnessProfile, weight_kg: weightKg, updated_at: nowISO() });
      }

      await updateProfile({ assessment_done: true });
      toast.success('Baseline saved', 'Everything from here is measured against this.');
      navigate('/', { replace: true });
    } catch {
      toast.error('Could not save your assessment', 'Please try again.');
      setSaving(false);
    }
  };

  const skipAll = async () => {
    await updateProfile({ assessment_done: false });
    navigate('/', { replace: true });
  };

  const SECTIONS: Array<{ key: Section; label: string; icon: typeof Ruler }> = [
    { key: 'body', label: 'Body', icon: HeartPulse },
    { key: 'measurements', label: 'Measurements', icon: Ruler },
    { key: 'performance', label: 'Performance', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-line sticky top-0 z-20 glass">
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
          <Logo />
          <span className="font-bold tracking-tight">FitHub</span>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => void skipAll()} icon={<SkipForward size={14} />}>
            Skip for now
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-5 py-8 sm:py-12">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-2xl bg-brand-soft grid place-items-center text-brand-text">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-text">FitStart Assessment</p>
            <h1 className="text-2xl font-black tracking-tight">Your starting point</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-3 leading-relaxed">
          Every field here is optional. Record whatever you are comfortable with — even one number gives
          you something honest to compare against in six weeks. You can add the rest later from Progress.
        </p>

        <div className="mt-6 flex gap-1 p-1 bg-surface-2 border border-line rounded-2xl" role="tablist">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              role="tab"
              type="button"
              aria-selected={section === s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium transition-all',
                section === s.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              <s.icon size={15} />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-5">
          {section === 'body' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label={`Weight (${weightUnit(units)})`} type="number" inputMode="decimal" step="0.1"
                  value={values.weight ?? ''} onChange={(e) => set('weight', e.target.value)}
                  placeholder={units === 'metric' ? '75' : '165'} inputSize="lg"
                />
                <Input
                  label="Resting heart rate (bpm)" type="number" inputMode="numeric"
                  value={values.rhr ?? ''} onChange={(e) => set('rhr', e.target.value)}
                  placeholder="62" inputSize="lg"
                  hint="Measured sitting still, ideally first thing in the morning."
                />
              </div>

              {bmiValue !== null && band && (
                <div className="card p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-3">Body mass index</span>
                    <span className="text-2xl font-black tabular">{bmiValue}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{band.label}</p>
                  <p className="mt-2 text-2xs text-ink-3 leading-relaxed">
                    BMI does not distinguish muscle from fat and is a poor individual measure — it is shown
                    here only as one rough reference point among several.
                  </p>
                </div>
              )}
            </>
          )}

          {section === 'measurements' && (
            <>
              <p className="flex items-start gap-2.5 p-3.5 rounded-xl bg-surface-2 border border-line text-xs text-ink-2 leading-relaxed">
                <Info size={14} className="shrink-0 mt-0.5 text-ink-3" />
                <span>
                  Circumference measurements often show change when the scale does not. Skip any you
                  would rather not record — nothing here is required, now or ever.
                </span>
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['waist', 'Waist'], ['chest', 'Chest'], ['arm', 'Upper arm'],
                  ['thigh', 'Thigh'], ['hip', 'Hips'],
                ].map(([key, label]) => (
                  <Input
                    key={key}
                    label={`${label} (${lengthUnit(units)})`} type="number" inputMode="decimal" step="0.1"
                    value={values[key] ?? ''} onChange={(e) => set(key, e.target.value)}
                    inputSize="lg"
                  />
                ))}
              </div>
            </>
          )}

          {section === 'performance' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Push-ups (max in one set)" type="number" inputMode="numeric"
                  value={values.pushups ?? ''} onChange={(e) => set('pushups', e.target.value)}
                  placeholder="15" inputSize="lg" hint="Stop when form breaks, not when it burns."
                />
                <Input
                  label="Plank hold (seconds)" type="number" inputMode="numeric"
                  value={values.plank ?? ''} onChange={(e) => set('plank', e.target.value)}
                  placeholder="45" inputSize="lg" hint="End the hold when your hips drop."
                />
                <Input
                  label="Bodyweight squats in 60 seconds" type="number" inputMode="numeric"
                  value={values.squats ?? ''} onChange={(e) => set('squats', e.target.value)}
                  placeholder="30" inputSize="lg"
                />
                <Input
                  label="Continuous walk/run (minutes)" type="number" inputMode="numeric"
                  value={values.endurance_min ?? ''} onChange={(e) => set('endurance_min', e.target.value)}
                  placeholder="20" inputSize="lg"
                />
                <Input
                  label="Distance covered (km)" type="number" inputMode="decimal" step="0.1"
                  value={values.endurance_km ?? ''} onChange={(e) => set('endurance_km', e.target.value)}
                  placeholder="2.5" inputSize="lg"
                />
              </div>

              <div>
                <Label hint="Sit on the floor with legs straight and reach toward your toes.">
                  Mobility — how far can you comfortably reach?
                </Label>
                <ScaleInput
                  name="Mobility"
                  value={mobility}
                  onChange={setMobility}
                  labels={['Well short of toes', 'Palms flat on floor']}
                />
              </div>

              <p className="flex items-start gap-2.5 text-xs text-ink-3 leading-relaxed">
                <Timer size={14} className="shrink-0 mt-0.5" />
                <span>Warm up first, and stop any test that causes pain rather than effort.</span>
              </p>
            </>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button variant="ghost" size="lg" onClick={() => void skipAll()}>I'll do this later</Button>
          <span className="flex-1" />
          <Button size="lg" onClick={() => void save()} loading={saving} iconRight={<ArrowRight size={17} />}>
            Save baseline
          </Button>
        </div>
      </main>
    </div>
  );
}
