import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon, Bell, Lock, Palette, Dumbbell, Download, Trash2,
  Database, HardDrive, AlertTriangle, Shield, Info, Sun, Moon, Monitor,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toggle, Select, Input } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/Tabs';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { backend, backendKind } from '@/lib/db';
import { HEALTH_DISCLAIMER } from '@/lib/defaults';
import { ROLE_LABEL, type NotificationKind, type Units } from '@/types';
import { toast } from '@/store/toast';
import { nowISO } from '@/lib/date';

const NOTIFICATION_LABELS: Record<NotificationKind, { label: string; description: string }> = {
  workout_reminder: { label: 'Workout reminders', description: 'A nudge at your preferred training time.' },
  rest_reminder: { label: 'Rest reminders', description: 'After several hard sessions in a row.' },
  goal_progress: { label: 'Goal progress', description: 'Milestones reached and goals achieved.' },
  achievement: { label: 'Achievements & records', description: 'New personal records and unlocked achievements.' },
  hydration: { label: 'Hydration reminders', description: 'Off by default — turn on only if you find it useful.' },
  trainer: { label: 'Trainer messages', description: 'Notes and messages from your coach.' },
  challenge: { label: 'Challenges', description: 'Progress and completion in challenges you joined.' },
  membership: { label: 'Membership', description: 'Renewals and expiry warnings.' },
  system: { label: 'System', description: 'Important account and app notices.' },
};

export default function Settings() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const prefs = useData((s) => s.preferences);
  const state = useData();
  const put = useData((s) => s.put);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!prefs || !profile) return null;

  const update = (patch: Partial<typeof prefs>) => void put('user_preferences', { ...prefs, ...patch, updated_at: nowISO() });

  const exportAccount = () => {
    const payload = {
      exported_at: nowISO(),
      profile,
      fitness_profile: state.fitnessProfile,
      preferences: prefs,
      goals: state.goals,
      programs: state.programs,
      sessions: state.sessions,
      sets: state.sets,
      records: state.records,
      recovery: state.recovery,
      niggles: state.niggles,
      measurements: state.measurements,
      habits: state.habits,
      habit_logs: state.habitLogs,
      nutrition: state.nutrition,
      nutrition_targets: state.nutritionTargets,
      achievements: state.achievements,
      assessments: state.assessments,
      challenge_members: state.challengeMembers,
      // Progress photos are deliberately excluded — they would balloon the file.
      progress_photos_count: state.photos.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fithub-export-${nowISO().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded', 'A complete copy of your training data.');
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await backend().deleteAccount(profile.id);
      await signOut();
      navigate('/welcome', { replace: true });
    } catch {
      toast.error('Could not delete the account', 'Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" />

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" icon={<Palette size={16} />} />
        <div className="p-5 pt-2 space-y-4">
          <div>
            <p className="text-sm font-medium text-ink-2 mb-2">Theme</p>
            <SegmentedControl
              value={prefs.theme}
              onChange={(v) => update({ theme: v })}
              options={[
                { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                { value: 'light', label: 'Light', icon: <Sun size={14} /> },
                { value: 'system', label: 'System', icon: <Monitor size={14} /> },
              ]}
            />
          </div>
          <Select
            label="Measurement units"
            value={prefs.units}
            onChange={(e) => {
              const units = e.target.value as Units;
              update({ units });
              if (state.fitnessProfile) void put('fitness_profiles', { ...state.fitnessProfile, units, updated_at: nowISO() });
            }}
            options={[{ value: 'metric', label: 'Metric — kg, cm, km' }, { value: 'imperial', label: 'Imperial — lb, in, mi' }]}
          />
          <Select
            label="Week starts on"
            value={String(prefs.week_starts_on)}
            onChange={(e) => update({ week_starts_on: Number(e.target.value) as 0 | 1 })}
            options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]}
          />
        </div>
      </Card>

      {/* Workout */}
      <Card>
        <CardHeader title="Workout" icon={<Dumbbell size={16} />} />
        <div className="p-5 pt-2 space-y-3">
          <Toggle
            checked={prefs.workout.auto_start_rest}
            onChange={(v) => update({ workout: { ...prefs.workout, auto_start_rest: v } })}
            label="Start rest timer automatically"
            description="Begins the countdown as soon as you complete a set — except after your last set of an exercise."
          />
          <Toggle
            checked={prefs.workout.sound}
            onChange={(v) => update({ workout: { ...prefs.workout, sound: v } })}
            label="Timer sounds"
            description="Countdown beeps and an end-of-phase tone."
          />
          <Toggle
            checked={prefs.workout.vibrate}
            onChange={(v) => update({ workout: { ...prefs.workout, vibrate: v } })}
            label="Vibration"
            description="Where the device supports it."
          />
          <Toggle
            checked={prefs.workout.keep_awake}
            onChange={(v) => update({ workout: { ...prefs.workout, keep_awake: v } })}
            label="Keep screen awake during timers"
            description="Uses the browser wake-lock API where available."
          />
          <Toggle
            checked={prefs.workout.plate_calculator}
            onChange={(v) => update({ workout: { ...prefs.workout, plate_calculator: v } })}
            label="Show plate calculator"
            description="Displays how to load a barbell for the weight you entered."
          />
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <Input
              label="Default rest (seconds)" type="number" inputMode="numeric" min={0} step={15}
              value={prefs.workout.default_rest_seconds}
              onChange={(e) => update({ workout: { ...prefs.workout, default_rest_seconds: Math.max(0, Number(e.target.value) || 0) } })}
            />
            <Input
              label="Barbell weight (kg)" type="number" inputMode="decimal" step="0.5" min={0}
              value={prefs.workout.bar_weight_kg}
              onChange={(e) => update({ workout: { ...prefs.workout, bar_weight_kg: Math.max(0, Number(e.target.value) || 0) } })}
            />
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card id="notifications">
        <CardHeader title="Notifications" icon={<Bell size={16} />} subtitle="You control every category independently." />
        <div className="p-5 pt-2 space-y-3">
          {(Object.keys(NOTIFICATION_LABELS) as NotificationKind[]).map((kind) => (
            <Toggle
              key={kind}
              checked={prefs.notifications[kind]}
              onChange={(v) => update({ notifications: { ...prefs.notifications, [kind]: v } })}
              label={NOTIFICATION_LABELS[kind].label}
              description={NOTIFICATION_LABELS[kind].description}
            />
          ))}
        </div>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader title="Privacy" icon={<Lock size={16} />} subtitle="Everything starts private. Sharing is always something you turn on." />
        <div className="p-5 pt-2 space-y-3">
          <Select
            label="Profile visibility"
            value={prefs.privacy.profile_visibility}
            onChange={(e) => update({ privacy: { ...prefs.privacy, profile_visibility: e.target.value as typeof prefs.privacy.profile_visibility } })}
            options={[
              { value: 'private', label: 'Private — only me' },
              { value: 'friends', label: 'Friends only' },
              { value: 'gym', label: 'Members of my gym' },
              { value: 'public', label: 'Anyone with the link' },
            ]}
          />
          <Toggle
            checked={prefs.privacy.share_workouts}
            onChange={(v) => update({ privacy: { ...prefs.privacy, share_workouts: v } })}
            label="Share completed workouts"
            description="Session type and duration only — never loads, notes or measurements."
          />
          <Toggle
            checked={prefs.privacy.share_records}
            onChange={(v) => update({ privacy: { ...prefs.privacy, share_records: v } })}
            label="Share personal records"
          />
          <Toggle
            checked={prefs.privacy.share_measurements}
            onChange={(v) => update({ privacy: { ...prefs.privacy, share_measurements: v } })}
            label="Share body measurements with my trainer"
            description="Only with a trainer you are explicitly assigned to."
          />
          <Toggle
            checked={prefs.privacy.leaderboard_opt_in}
            onChange={(v) => update({ privacy: { ...prefs.privacy, leaderboard_opt_in: v } })}
            label="Appear on challenge leaderboards"
          />
          <p className="pt-1 flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
            <Shield size={12} className="shrink-0 mt-0.5" />
            Progress photos, recovery check-ins and nutrition logs are never shared with anyone under any
            of these settings.
          </p>
        </div>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader title="Accessibility" icon={<SettingsIcon size={16} />} />
        <div className="p-5 pt-2 space-y-3">
          <Toggle
            checked={prefs.reduced_motion}
            onChange={(v) => update({ reduced_motion: v })}
            label="Reduce motion"
            description="Minimises animations. FitHub also respects your system's reduced-motion setting automatically."
          />
          <p className="flex items-start gap-2 text-2xs text-ink-3 leading-relaxed">
            <Info size={12} className="shrink-0 mt-0.5" />
            The whole app is keyboard navigable, uses visible focus rings, and never communicates status
            through colour alone.
          </p>
        </div>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader title="Your data" icon={backendKind() === 'supabase' ? <Database size={16} /> : <HardDrive size={16} />} />
        <div className="p-5 pt-2 space-y-4">
          <div className="p-4 rounded-2xl bg-surface-2 border border-line">
            <div className="flex items-center gap-2">
              <Badge tone={backendKind() === 'supabase' ? 'success' : 'info'}>
                {backendKind() === 'supabase' ? 'Supabase (Postgres)' : 'Local browser storage'}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-ink-2 leading-relaxed">
              {backendKind() === 'supabase'
                ? 'Your data is stored in your Supabase project. Row-level security policies enforce that you can only read and write your own rows.'
                : 'Your account and all training data live in this browser only. Nothing is sent anywhere — which also means it does not sync between devices, and clearing site data would remove it. Add Supabase credentials to your .env for a real backend.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportAccount} icon={<Download size={15} />}>Export my data</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} icon={<Trash2 size={15} />} className="text-danger hover:bg-danger-soft">
              Delete my account
            </Button>
          </div>
          <p className="text-2xs text-ink-3 leading-relaxed">
            The export is a complete JSON copy of your workouts, sets, goals, records, recovery, habits and
            nutrition. Progress photos are excluded from the file because of their size — download them from
            the Progress page.
          </p>
        </div>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader title="Account" />
        <dl className="p-5 pt-2 space-y-2 text-sm">
          <div className="flex justify-between border-b border-line pb-2"><dt className="text-ink-3">Email</dt><dd className="font-medium">{profile.email}</dd></div>
          <div className="flex justify-between border-b border-line pb-2"><dt className="text-ink-3">Role</dt><dd className="font-medium">{ROLE_LABEL[profile.role]}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-3">Account ID</dt><dd className="font-mono text-2xs text-ink-3">{profile.id}</dd></div>
        </dl>
        <div className="px-5 pb-5">
          <Button variant="outline" onClick={() => void signOut().then(() => navigate('/welcome'))}>Sign out</Button>
        </div>
      </Card>

      <p className="text-2xs text-ink-3 leading-relaxed border-t border-line pt-5">{HEALTH_DISCLAIMER}</p>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deleteAccount()}
        title="Delete your account?"
        body="This permanently removes your profile, workouts, goals, records, measurements, photos and every other record. It cannot be undone. Consider exporting your data first."
        confirmLabel="Delete permanently"
        busy={deleting}
      />

      {confirmDelete && (
        <div className="sr-only" role="alert">
          <AlertTriangle /> Account deletion is permanent.
        </div>
      )}
    </div>
  );
}
