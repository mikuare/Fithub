import { useState } from 'react';
import {
  Building2, CalendarPlus, ImagePlus, Plus, Store, Tag, Trash2, Upload, X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Toggle } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { JoinCodeChip } from '@/components/gym/JoinCodeChip';
import { useData } from '@/store/data';
import { GYM_CURRENCIES, formatMoney, setupProgress, setupSteps } from '@/lib/gym/tenant';
import { prepareGymPhoto, prepareProfileImage } from '@/lib/profileImage';
import { formatClock } from '@/lib/date';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import type { GymClass, MembershipPlan, Weekday } from '@/types';

/* ============================================================
   Gym settings
   Everything a gym owner sets up themselves: how the gym looks,
   what it charges, and what is on the timetable. Deliberately one
   page — three separate screens for "my gym" would hide the fact
   that pricing and timetable are what make the rest work.
   ============================================================ */

const WEEKDAYS: Array<{ value: Weekday; label: string }> = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export default function GymSettings() {
  const gym = useData((s) => s.gym);
  const plans = useData((s) => s.plans);
  const gymClasses = useData((s) => s.gymClasses);
  const updateGym = useData((s) => s.updateGym);
  const put = useData((s) => s.put);
  const del = useData((s) => s.del);

  const [planDraft, setPlanDraft] = useState<MembershipPlan | null>(null);
  const [classDraft, setClassDraft] = useState<GymClass | null>(null);
  const [uploading, setUploading] = useState<'logo' | 'photo' | null>(null);

  if (!gym) {
    return (
      <div className="max-w-3xl">
        <PageHeader eyebrow="Gym" title="Gym settings" />
        <Card>
          <EmptyState
            icon={<Store size={22} />}
            title="No gym on this account"
            body="Create a gym first and you will become its manager."
            action={<Button to="/gym">Set up a gym</Button>}
          />
        </Card>
      </div>
    );
  }

  const myPlans = plans.filter((p) => p.gym_id === gym.id);
  const myClasses = gymClasses
    .filter((c) => c.gym_id === gym.id)
    .sort((a, b) => (a.weekday - b.weekday) || a.start_time.localeCompare(b.start_time));
  const steps = setupSteps(gym, myPlans.length, myClasses.length);
  const progress = setupProgress(steps);

  const field = (patch: Parameters<typeof updateGym>[0]) => void updateGym(patch);

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Gym"
        title={gym.name}
        subtitle="How your gym looks to members, what it charges, and what they can book."
        actions={<Button to="/admin/desk" size="sm" variant="outline">Front desk</Button>}
      />

      {progress < 100 && (
        <Card className="border-brand/30">
          <CardHeader title="Finish setting up" subtitle={`${progress}% done — members can already join`} dense />
          <div className="px-4 pb-4 pt-1">
            <ProgressBar value={progress} max={100} />
            <ul className="mt-3 space-y-1.5">
              {steps.filter((s) => !s.done).map((s) => (
                <li key={s.key} className="text-xs leading-snug">
                  <span className="font-semibold">{s.label}.</span>{' '}
                  <span className="text-ink-3">{s.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Your join code" subtitle="Members type this to join. Nothing is listed publicly." dense />
        <div className="flex flex-wrap items-center gap-3 p-4 pt-2">
          <JoinCodeChip code={gym.join_code} />
          <p className="text-2xs text-ink-3 leading-relaxed max-w-sm">
            Print it at the desk or send it when someone signs up. Anyone with the code can join, so treat
            it like a door key rather than a secret.
          </p>
        </div>
      </Card>

      {/* ---------------- branding ---------------- */}
      <Card>
        <CardHeader title="Branding" subtitle="The first thing a member sees" dense icon={<ImagePlus size={16} className="text-ink-3" />} />
        <div className="p-4 pt-2 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface-2 grid place-items-center">
              {gym.logo_data_url
                ? <img src={gym.logo_data_url} alt={`${gym.name} logo`} className="h-full w-full object-cover" />
                : <Building2 size={22} className="text-ink-3" aria-hidden />}
            </div>
            <div>
              <label className="inline-flex">
                <input
                  type="file" accept="image/*" className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    setUploading('logo');
                    try {
                      field({ logo_data_url: await prepareProfileImage(file) });
                      toast.success('Logo updated');
                    } catch (err) {
                      toast.error('Could not use that image', err instanceof Error ? err.message : undefined);
                    } finally { setUploading(null); }
                  }}
                />
                <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-surface-2">
                  <Upload size={14} aria-hidden /> {uploading === 'logo' ? 'Preparing…' : 'Upload logo'}
                </span>
              </label>
              {gym.logo_data_url && (
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => field({ logo_data_url: null })}>Remove</Button>
              )}
              <p className="mt-1.5 text-2xs text-ink-3">Square, cropped and compressed automatically.</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Photos <span className="text-ink-3 font-normal">({gym.photos.length}/6)</span></p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gym.photos.map((src, i) => (
                <div key={src.slice(-24)} className="relative">
                  <img src={src} alt={`Gym photo ${i + 1}`} className="aspect-video w-full rounded-xl border border-line object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => field({ photos: gym.photos.filter((p) => p !== src) })}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-bg/85 text-ink backdrop-blur hover:text-danger"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </div>
              ))}
              {gym.photos.length < 6 && (
                <label className="grid aspect-video cursor-pointer place-items-center rounded-xl border border-dashed border-line-strong text-ink-3 hover:border-brand/50 hover:text-brand-text">
                  <input
                    type="file" accept="image/*" className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setUploading('photo');
                      try {
                        field({ photos: [...gym.photos, await prepareGymPhoto(file)] });
                        toast.success('Photo added');
                      } catch (err) {
                        toast.error('Could not use that image', err instanceof Error ? err.message : undefined);
                      } finally { setUploading(null); }
                    }}
                  />
                  <span className="flex flex-col items-center gap-1 text-2xs font-semibold">
                    <Plus size={16} aria-hidden />{uploading === 'photo' ? 'Preparing…' : 'Add photo'}
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ---------------- details ---------------- */}
      <Card>
        <CardHeader title="Details" subtitle="Where you are and when you are open" dense />
        <div className="grid gap-3 p-4 pt-2 sm:grid-cols-2">
          <Input label="Gym name" defaultValue={gym.name} onBlur={(e) => field({ name: e.target.value.trim() || gym.name })} />
          <Input label="Address" defaultValue={gym.address} onBlur={(e) => field({ address: e.target.value })} />
          <Input label="Phone" defaultValue={gym.phone} onBlur={(e) => field({ phone: e.target.value })} />
          <Input label="Email" type="email" defaultValue={gym.email} onBlur={(e) => field({ email: e.target.value })} />
          <Input label="Opens (hour)" type="number" min="0" max="23" defaultValue={gym.open_hour} onBlur={(e) => field({ open_hour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })} />
          <Input label="Closes (hour)" type="number" min="1" max="24" defaultValue={gym.close_hour} onBlur={(e) => field({ close_hour: Math.min(24, Math.max(1, Number(e.target.value) || 24)) })} />
          <Input label="Floor capacity" type="number" min="1" defaultValue={gym.capacity} onBlur={(e) => field({ capacity: Math.max(1, Number(e.target.value) || 1) })} />
          <div>
            <label htmlFor="settings-currency" className="block text-sm font-medium mb-1.5">Currency</label>
            <select
              id="settings-currency" value={gym.currency}
              onChange={(e) => field({ currency: e.target.value })}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
            >
              {GYM_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="gym-description" className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              id="gym-description" rows={3} defaultValue={gym.description}
              onBlur={(e) => field({ description: e.target.value })}
              placeholder="What makes your gym worth walking into."
              className="w-full rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed"
            />
          </div>
          <div className="sm:col-span-2">
            <Toggle
              checked={gym.active}
              onChange={(v) => field({ active: v })}
              label="Accepting new members"
              description="Turn this off and the join code stops working. Existing members keep their access."
            />
          </div>
        </div>
      </Card>

      {/* ---------------- pricing ---------------- */}
      <Card>
        <CardHeader
          title="Pricing"
          subtitle={`Paid in cash at the desk · ${gym.currency}`}
          dense
          icon={<Tag size={16} className="text-ink-3" />}
          action={
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setPlanDraft({
              id: uid('plan'), gym_id: gym.id, name: '', price: 0, currency: gym.currency,
              months: 1, perks: [], includes_classes: false,
            })}>Add plan</Button>
          }
        />
        <div className="p-4 pt-2">
          {myPlans.length === 0 ? (
            <p className="text-sm text-ink-3">No plans yet. Members cannot buy a membership until there is at least one.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {myPlans.map((p) => (
                <li key={p.id} className="rounded-xl border border-line bg-surface-2/50 p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="font-black tabular text-brand-text shrink-0">{formatMoney(p.price, p.currency)}</p>
                  </div>
                  <p className="text-2xs text-ink-3">
                    per month{p.months > 1 ? `, ${p.months}-month term` : ''}
                    {p.includes_classes ? ' · classes included' : ' · classes charged per drop-in'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPlanDraft(p)}>Edit</Button>
                    <Button
                      size="sm" variant="ghost" icon={<Trash2 size={13} />}
                      onClick={() => void del('membership_plans', p.id)}
                    >Delete</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* ---------------- timetable ---------------- */}
      <Card>
        <CardHeader
          title="Timetable"
          subtitle="Weekly classes members can book a spot in"
          dense
          icon={<CalendarPlus size={16} className="text-ink-3" />}
          action={
            <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => setClassDraft({
              id: uid('cls'), gym_id: gym.id, name: '', description: '', weekday: 1,
              start_time: '18:00', duration_minutes: 45, capacity: 12, trainer_id: null,
              price: 0, active: true,
            })}>Add class</Button>
          }
        />
        <div className="p-4 pt-2">
          {myClasses.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing on the timetable yet, so there is nothing to book.</p>
          ) : (
            <ul className="divide-y divide-line">
              {myClasses.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold truncate">{c.name || 'Untitled class'}</p>
                      {!c.active && <Badge tone="muted" size="sm">Unpublished</Badge>}
                    </div>
                    <p className="text-2xs text-ink-3">
                      {WEEKDAYS.find((w) => w.value === c.weekday)?.label} · {formatClock(c.start_time)} ·{' '}
                      {c.duration_minutes} min · {c.capacity} spots ·{' '}
                      {c.price > 0 ? `${formatMoney(c.price, gym.currency)} drop-in` : 'free / included'}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setClassDraft(c)}>Edit</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void del('gym_classes', c.id)}>Delete</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {planDraft && (
        <PlanModal
          plan={planDraft}
          onClose={() => setPlanDraft(null)}
          onSave={async (next) => { await put('membership_plans', next); setPlanDraft(null); toast.success('Plan saved'); }}
        />
      )}
      {classDraft && (
        <ClassModal
          gymClass={classDraft}
          currency={gym.currency}
          onClose={() => setClassDraft(null)}
          onSave={async (next) => { await put('gym_classes', next); setClassDraft(null); toast.success('Class saved'); }}
        />
      )}
    </div>
  );
}

function PlanModal({ plan, onClose, onSave }: {
  plan: MembershipPlan;
  onClose: () => void;
  onSave: (plan: MembershipPlan) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(plan);
  const [perks, setPerks] = useState(plan.perks.join('\n'));
  return (
    <Modal
      open onClose={onClose} title={plan.name ? 'Edit plan' : 'New plan'}
      footer={
        <Button block disabled={!draft.name.trim()} onClick={() => void onSave({
          ...draft,
          name: draft.name.trim(),
          perks: perks.split('\n').map((p) => p.trim()).filter(Boolean),
        })}>Save plan</Button>
      }
    >
      <div className="space-y-3">
        <Input label="Plan name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Monthly" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={`Price per month (${draft.currency})`} type="number" min="0" step="0.01" value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value) || 0) })} />
          <Input label="Term (months)" type="number" min="1" value={draft.months}
            onChange={(e) => setDraft({ ...draft, months: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
        <div>
          <label htmlFor="plan-perks" className="block text-sm font-medium mb-1.5">What is included</label>
          <textarea id="plan-perks" rows={4} value={perks} onChange={(e) => setPerks(e.target.value)}
            placeholder={'One per line\nFull gym access\nTwo guest passes'}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed" />
        </div>
        <Toggle
          checked={draft.includes_classes}
          onChange={(v) => setDraft({ ...draft, includes_classes: v })}
          label="Classes included"
          description="On, members on this plan book classes at no extra charge. Off, they pay the drop-in price in cash."
        />
      </div>
    </Modal>
  );
}

function ClassModal({ gymClass, currency, onClose, onSave }: {
  gymClass: GymClass;
  currency: string;
  onClose: () => void;
  onSave: (gymClass: GymClass) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(gymClass);
  return (
    <Modal
      open onClose={onClose} title={gymClass.name ? 'Edit class' : 'New class'}
      footer={<Button block disabled={!draft.name.trim()} onClick={() => void onSave({ ...draft, name: draft.name.trim() })}>Save class</Button>}
    >
      <div className="space-y-3">
        <Input label="Class name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Spin" required />
        <div>
          <label htmlFor="class-desc" className="block text-sm font-medium mb-1.5">Description</label>
          <textarea id="class-desc" rows={2} value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What members should expect."
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="class-weekday" className="block text-sm font-medium mb-1.5">Day</label>
            <select id="class-weekday" value={draft.weekday}
              onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) as Weekday })}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm">
              {WEEKDAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>
          <Input label="Start time" type="time" value={draft.start_time}
            onChange={(e) => setDraft({ ...draft, start_time: e.target.value || '18:00' })} />
          <Input label="Length (minutes)" type="number" min="10" step="5" value={draft.duration_minutes}
            onChange={(e) => setDraft({ ...draft, duration_minutes: Math.max(10, Number(e.target.value) || 45) })} />
          <Input label="Spots" type="number" min="1" value={draft.capacity}
            onChange={(e) => setDraft({ ...draft, capacity: Math.max(1, Number(e.target.value) || 1) })} />
          <Input label={`Drop-in price (${currency})`} type="number" min="0" step="0.01" value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
        <p className="text-2xs text-ink-3 leading-relaxed">
          Set the drop-in price to 0 to make the class free for everyone. Members on a plan that includes
          classes never pay it either way.
        </p>
        <Toggle
          checked={draft.active}
          onChange={(v) => setDraft({ ...draft, active: v })}
          label="Published"
          description="Off, the class disappears from the members' timetable instead of showing as unbookable."
        />
      </div>
    </Modal>
  );
}
