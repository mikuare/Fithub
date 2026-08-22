import { useMemo, useRef, useState } from 'react';
import {
  Save, Dumbbell, Target, Ruler, Calendar, Award, Pencil, Building2, IdCard,
  Camera, Loader2, Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, ChoiceCard, Label } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatTile } from '@/components/dashboard/StatTile';
import { Avatar } from '@/components/layout/AppShell';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useFitScore, useStreak } from '@/lib/selectors';
import { GOAL_LABEL, generateProgram } from '@/lib/fitness/program';
import { EQUIPMENT_LABEL } from '@/data/exercises';
import { bmi, bmiBand } from '@/lib/fitness/calculations';
import { displayLength, displayWeight, inputLengthToCm, inputWeightToKg, lengthUnit, weightUnit } from '@/lib/fitness/units';
import { ageFrom, DAY_SHORT, formatClock, formatDate, nowISO, today } from '@/lib/date';
import { titleCase } from '@/lib/utils';
import { prepareProfileImage } from '@/lib/profileImage';
import { toast } from '@/store/toast';
import { ROLE_LABEL, type Equipment, type Experience, type GoalKind, type Units, type Weekday } from '@/types';

export default function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const fitnessProfile = useData((s) => s.fitnessProfile);
  const memberships = useData((s) => s.memberships);
  const gym = useData((s) => s.gym);
  const plans = useData((s) => s.plans);
  const sessions = useData((s) => s.sessions);
  const records = useData((s) => s.records);
  const assessments = useData((s) => s.assessments);
  const put = useData((s) => s.put);
  const streak = useStreak();
  const fitScore = useFitScore();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [editingFitness, setEditingFitness] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const units = fitnessProfile?.units ?? 'metric';
  const bmiValue = bmi(fitnessProfile?.weight_kg ?? null, fitnessProfile?.height_cm ?? null);
  const band = bmiBand(bmiValue);
  const membership = memberships[0];
  const plan = plans.find((p) => p.id === membership?.plan_id);
  const age = ageFrom(fitnessProfile?.birth_date ?? null);

  const completed = sessions.filter((s) => s.status === 'completed').length;

  if (!profile) return null;

  const saveAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      const avatar_data_url = await prepareProfileImage(file);
      await updateProfile({ avatar_data_url });
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error('Could not use that photo', error instanceof Error ? error.message : 'Choose another image and try again.');
    } finally {
      setAvatarBusy(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader eyebrow="Account" title="Profile" />

      {/* Identity */}
      <Card>
        <div className="p-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarBusy}
            aria-label={profile.avatar_data_url ? 'Change profile photo' : 'Upload profile photo'}
            className="group relative shrink-0 rounded-full disabled:opacity-60"
          >
            <Avatar profile={profile} size={64} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {avatarBusy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.jfif,.png,.webp,.avif,.gif,.bmp,.heic,.heif"
            className="sr-only"
            onChange={(event) => void saveAvatar(event.target.files?.[0])}
            aria-label="Choose a profile photo"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold truncate">{profile.full_name}</h2>
              <button type="button" onClick={() => { setName(profile.full_name); setEditingName(true); }}
                aria-label="Edit name"
                className="h-7 w-7 grid place-items-center rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2">
                <Pencil size={13} />
              </button>
            </div>
            <p className="text-sm text-ink-3">{profile.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge>
              <Badge tone="muted">Joined {formatDate(profile.created_at.slice(0, 10), 'medium')}</Badge>
              {profile.onboarded && <Badge tone="success">Profile complete</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
                icon={<Camera size={13} />}
              >
                {profile.avatar_data_url ? 'Change photo' : 'Upload photo'}
              </Button>
              {profile.avatar_data_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => void updateProfile({ avatar_data_url: null }).then(() => toast.info('Profile photo removed'))}
                  icon={<Trash2 size={13} />}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-2 text-2xs text-ink-3">
              JPG, JPEG, PNG, WebP and other common images · up to 25 MB. FitHub crops and compresses the photo for you.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Workouts" value={completed} icon={<Dumbbell size={15} />} />
        <StatTile label="Records" value={records.length} icon={<Award size={15} />} />
        <StatTile label="Streak" value={streak.current} unit="days" icon={<Calendar size={15} />} tone="brand" />
        <StatTile label="FitScore" value={fitScore.total} icon={<Target size={15} />} />
      </div>

      {/* Fitness profile */}
      <Card>
        <CardHeader
          title="Fitness profile"
          subtitle="This drives every programme and recommendation FitHub makes."
          action={<Button variant="outline" size="sm" onClick={() => setEditingFitness(true)} icon={<Pencil size={13} />}>Edit</Button>}
        />
        {fitnessProfile ? (
          <dl className="p-5 pt-2 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Preferred name', fitnessProfile.first_name || '—'],
              ['Gender', titleCase(fitnessProfile.gender)],
              ['Age', age !== null ? `${age}` : 'Not set'],
              ['Height', fitnessProfile.height_cm ? `${displayLength(fitnessProfile.height_cm, units)} ${lengthUnit(units)}` : 'Not set'],
              ['Weight', fitnessProfile.weight_kg ? `${displayWeight(fitnessProfile.weight_kg, units)} ${weightUnit(units)}` : 'Not set'],
              ['BMI', bmiValue !== null ? `${bmiValue} — ${band?.label}` : 'Not available'],
              ['Experience', titleCase(fitnessProfile.experience)],
              ['Primary goal', GOAL_LABEL[fitnessProfile.primary_goal]],
              ['Training location', titleCase(fitnessProfile.location)],
              ['Sessions per week', String(fitnessProfile.days_per_week)],
              ['Preferred days', fitnessProfile.preferred_days.map((d) => DAY_SHORT[d]).join(', ') || 'Flexible'],
              ['Preferred time', formatClock(fitnessProfile.preferred_time)],
              ['Session length', `${fitnessProfile.session_minutes} minutes`],
              ['Units', titleCase(fitnessProfile.units)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
            <div className="sm:col-span-2">
              <dt className="text-ink-3 text-sm mb-1.5">Equipment available</dt>
              <dd className="flex flex-wrap gap-1.5">
                {fitnessProfile.equipment.map((e) => (
                  <Badge key={e} tone="muted" size="sm">{EQUIPMENT_LABEL[e] ?? e}</Badge>
                ))}
              </dd>
            </div>
            {fitnessProfile.activities.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-ink-3 text-sm mb-1.5">Activities enjoyed</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {fitnessProfile.activities.map((a) => <Badge key={a} tone="muted" size="sm">{titleCase(a)}</Badge>)}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="p-5 text-sm text-ink-3">No fitness profile yet.</p>
        )}
      </Card>

      {/* Safety */}
      {fitnessProfile && (
        <Card className={fitnessProfile.safety.flagged ? 'border-warn/40' : undefined}>
          <CardHeader title="Safety screening" subtitle="Used to keep exercise selection appropriate." />
          <dl className="p-5 pt-2 space-y-2 text-sm">
            {[
              ['Chest pain during exercise', fitnessProfile.safety.chest_pain ? 'Yes' : 'No'],
              ['Dizziness during exercise', fitnessProfile.safety.dizziness ? 'Yes' : 'No'],
              ['Recovering from surgery or injury', fitnessProfile.safety.recent_surgery ? 'Yes' : 'No'],
              ['Injuries noted', fitnessProfile.safety.injuries || 'None recorded'],
              ['Movement limitations', fitnessProfile.safety.movement_limitations || 'None recorded'],
              ['Doctor restrictions', fitnessProfile.safety.doctor_restrictions || 'None recorded'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line pb-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {(fitnessProfile.safety.chest_pain || fitnessProfile.safety.dizziness || fitnessProfile.safety.recent_surgery) && (
            <div className="px-5 pb-5">
              <p className="p-3.5 rounded-xl bg-warn-soft border border-warn/30 text-sm text-ink-2 leading-relaxed">
                Consider consulting a qualified healthcare professional before starting or significantly
                changing your exercise programme. FitHub keeps your programme conservative while these are set.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Membership */}
      {membership && gym && (
        <Card>
          <CardHeader title="Gym membership" icon={<Building2 size={16} />} />
          <dl className="p-5 pt-2 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Gym', gym.name],
              ['Plan', plan?.name ?? '—'],
              ['Status', titleCase(membership.status)],
              ['Member code', membership.member_code],
              ['Started', formatDate(membership.start_date, 'medium')],
              ['Renews', formatDate(membership.end_date, 'medium')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="px-5 pb-5 flex items-center gap-3">
            <IdCard size={16} className="text-ink-3" />
            <p className="text-2xs text-ink-3">Show this code at the front desk, or scan the QR on the attendance screen.</p>
          </div>
        </Card>
      )}

      {/* Assessments */}
      <Card>
        <CardHeader
          title="FitStart assessments"
          subtitle={assessments.length ? `${assessments.length} recorded` : 'None recorded'}
          action={<Button variant="outline" size="sm" to="/assessment" icon={<Ruler size={13} />}>Take assessment</Button>}
        />
        {assessments.length > 0 && (
          <ul className="divide-y divide-line">
            {[...assessments].sort((a, b) => b.taken_at.localeCompare(a.taken_at)).map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                <span className="w-28 shrink-0 font-medium">{formatDate(a.taken_at.slice(0, 10), 'medium')}</span>
                <span className="flex-1 text-2xs text-ink-3 tabular flex flex-wrap gap-x-4 gap-y-1">
                  {a.weight_kg && <span>{displayWeight(a.weight_kg, units)} {weightUnit(units)}</span>}
                  {a.pushups && <span>{a.pushups} push-ups</span>}
                  {a.plank_seconds && <span>{a.plank_seconds}s plank</span>}
                  {a.resting_hr && <span>{a.resting_hr} bpm</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Name modal */}
      <Modal
        open={editingName} onClose={() => setEditingName(false)} title="Edit your name" size="sm"
        footer={
          <Button block onClick={async () => { await updateProfile({ full_name: name.trim() || profile.full_name }); setEditingName(false); toast.success('Name updated'); }}>
            Save
          </Button>
        }
      >
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} inputSize="lg" autoFocus />
      </Modal>

      {editingFitness && fitnessProfile && (
        <FitnessProfileModal
          onClose={() => setEditingFitness(false)}
          onSave={async (next, regenerate) => {
            await put('fitness_profiles', { ...next, updated_at: nowISO() });
            if (regenerate) {
              const current = useData.getState().programs.find((p) => p.active);
              if (current) await put('programs', { ...current, active: false });
              const program = generateProgram(next, profile.id, { seed: Date.now() % 1_000_000 });
              await put('programs', program);
              toast.success('Profile saved', 'Your programme was rebuilt to match.');
            } else {
              toast.success('Profile saved');
            }
            setEditingFitness(false);
          }}
        />
      )}
    </div>
  );
}

const EQUIPMENT_OPTIONS: Equipment[] = [
  'bodyweight', 'dumbbells', 'barbell', 'bench', 'squat_rack', 'cable', 'machine',
  'smith', 'kettlebell', 'bands', 'pullup_bar', 'treadmill', 'bike', 'rower',
];

function FitnessProfileModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (p: NonNullable<ReturnType<typeof useData.getState>['fitnessProfile']>, regenerate: boolean) => void | Promise<void>;
}) {
  const original = useData((s) => s.fitnessProfile)!;
  const [draft, setDraft] = useState(original);
  const [regenerate, setRegenerate] = useState(false);

  const structuralChange = useMemo(
    () =>
      draft.primary_goal !== original.primary_goal ||
      draft.experience !== original.experience ||
      draft.days_per_week !== original.days_per_week ||
      draft.session_minutes !== original.session_minutes ||
      JSON.stringify(draft.equipment) !== JSON.stringify(original.equipment),
    [draft, original],
  );

  const units = draft.units;

  return (
    <Modal
      open onClose={onClose} title="Edit fitness profile" size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-3">
          {structuralChange && (
            <label className="flex items-center gap-2 text-xs text-ink-2 cursor-pointer">
              <input type="checkbox" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)}
                className="accent-[rgb(var(--c-brand))]" />
              Rebuild my programme with these changes
            </label>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void onSave(draft, regenerate)} icon={<Save size={15} />}>Save</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Preferred name" value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} />
          <Select
            label="Units" value={draft.units}
            onChange={(e) => setDraft({ ...draft, units: e.target.value as Units })}
            options={[{ value: 'metric', label: 'Metric (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, in)' }]}
          />
          <Input label="Date of birth" type="date" max={today()} value={draft.birth_date ?? ''}
            onChange={(e) => setDraft({ ...draft, birth_date: e.target.value || null })} />
          <Input
            label={`Height (${lengthUnit(units)})`} type="number" inputMode="decimal" step="0.1"
            value={displayLength(draft.height_cm, units) ?? ''}
            onChange={(e) => setDraft({ ...draft, height_cm: e.target.value ? inputLengthToCm(Number(e.target.value), units) : null })}
          />
          <Input
            label={`Weight (${weightUnit(units)})`} type="number" inputMode="decimal" step="0.1"
            value={displayWeight(draft.weight_kg, units) ?? ''}
            onChange={(e) => setDraft({ ...draft, weight_kg: e.target.value ? inputWeightToKg(Number(e.target.value), units) : null })}
          />
          <Select
            label="Experience" value={draft.experience}
            onChange={(e) => setDraft({ ...draft, experience: e.target.value as Experience })}
            options={[
              { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
          <Select
            label="Primary goal" value={draft.primary_goal}
            onChange={(e) => setDraft({ ...draft, primary_goal: e.target.value as GoalKind })}
            options={(Object.keys(GOAL_LABEL) as GoalKind[]).map((g) => ({ value: g, label: GOAL_LABEL[g] }))}
          />
          <Select
            label="Session length" value={String(draft.session_minutes)}
            onChange={(e) => setDraft({ ...draft, session_minutes: Number(e.target.value) })}
            options={[20, 30, 45, 60, 75, 90].map((m) => ({ value: String(m), label: `${m} minutes` }))}
          />
          <Input label="Preferred time" type="time" value={draft.preferred_time}
            onChange={(e) => setDraft({ ...draft, preferred_time: e.target.value })} />
        </div>

        <div>
          <Label>Sessions per week</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n} type="button" aria-pressed={draft.days_per_week === n}
                onClick={() => setDraft({ ...draft, days_per_week: n, preferred_days: draft.preferred_days.slice(0, n) })}
                className={`flex-1 h-11 rounded-xl border font-bold tabular transition-all ${
                  draft.days_per_week === n ? 'bg-brand text-brand-contrast border-brand' : 'bg-surface-2 border-line text-ink-2'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Preferred days</Label>
          <div className="flex gap-1.5">
            {DAY_SHORT.map((label, i) => {
              const day = i as Weekday;
              const on = draft.preferred_days.includes(day);
              return (
                <button
                  key={label + i} type="button" aria-pressed={on} aria-label={label}
                  onClick={() => setDraft({
                    ...draft,
                    preferred_days: on
                      ? draft.preferred_days.filter((d) => d !== day)
                      : [...draft.preferred_days, day].sort((a, b) => a - b),
                  })}
                  className={`flex-1 h-10 rounded-xl border text-xs font-semibold transition-all ${
                    on ? 'bg-brand text-brand-contrast border-brand' : 'bg-surface-2 border-line text-ink-2'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Equipment available</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EQUIPMENT_OPTIONS.map((eq) => (
              <ChoiceCard
                key={eq}
                multi
                selected={draft.equipment.includes(eq)}
                onSelect={() => setDraft({
                  ...draft,
                  equipment: draft.equipment.includes(eq)
                    ? draft.equipment.filter((e) => e !== eq)
                    : [...draft.equipment, eq],
                })}
                title={EQUIPMENT_LABEL[eq] ?? eq}
                disabled={eq === 'bodyweight'}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
