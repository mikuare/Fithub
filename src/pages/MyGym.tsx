import { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, Check, KeyRound, Mail, MapPin, Phone, Store, Ticket, Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import { activeMembershipOn, cashOwed } from '@/lib/gym/booking';
import { formatJoinCode, formatMoney, GYM_CURRENCIES } from '@/lib/gym/tenant';
import { today } from '@/lib/date';
import { toast } from '@/store/toast';

/* ============================================================
   My gym
   One page for both sides of the front door: someone with no gym
   sees the two ways in — join with a code, or set one up — and
   someone who has joined sees the gym itself, its pricing and
   what they owe at the desk.
   ============================================================ */

export default function MyGym() {
  const gym = useData((s) => s.gym);
  const plans = useData((s) => s.plans);
  const memberships = useData((s) => s.memberships);
  const bookings = useData((s) => s.bookings);
  const takeMembership = useData((s) => s.takeMembership);
  const profile = useAuth((s) => s.profile);
  const [taking, setTaking] = useState<string | null>(null);

  const joined = Boolean(gym && profile?.gym_id === gym.id);
  if (!gym || !joined) return <NoGym />;

  const gymPlans = plans.filter((p) => p.gym_id === gym.id);
  const membership = activeMembershipOn(memberships, gym.id, today());
  const plan = membership ? gymPlans.find((p) => p.id === membership.plan_id) ?? null : null;
  const owed = cashOwed(bookings.filter((b) => b.gym_id === gym.id), gym.currency);

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        eyebrow="My gym"
        title={gym.name}
        subtitle={gym.description || 'Your gym has not written a description yet.'}
        actions={<Button to="/book" size="sm" icon={<CalendarDays size={14} />}>Book a class</Button>}
      />

      {gym.photos.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {gym.photos.slice(0, 3).map((src, i) => (
            <img
              key={src.slice(-24)}
              src={src}
              alt={`${gym.name}, photo ${i + 1}`}
              className="aspect-video w-full rounded-2xl border border-line object-cover"
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr,1.3fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Where to find us" dense icon={<Building2 size={16} className="text-ink-3" />} />
            <div className="px-4 pb-4 pt-1 space-y-2 text-sm">
              {gym.logo_data_url && (
                <img src={gym.logo_data_url} alt={`${gym.name} logo`} className="h-16 w-16 rounded-xl border border-line object-cover" />
              )}
              {gym.address && <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" />{gym.address}</p>}
              {gym.phone && <p className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-ink-3" />{gym.phone}</p>}
              {gym.email && <p className="flex items-center gap-2"><Mail size={14} className="shrink-0 text-ink-3" />{gym.email}</p>}
              <p className="text-xs text-ink-3 pt-1">
                Open {String(gym.open_hour).padStart(2, '0')}:00 – {String(gym.close_hour).padStart(2, '0')}:00
              </p>
            </div>
          </Card>

          <Card className={owed.owed > 0 ? 'border-warn/40' : undefined}>
            <CardHeader title="To pay at the desk" dense icon={<Wallet size={16} className="text-ink-3" />} />
            <div className="px-4 pb-4 pt-1">
              {owed.owed > 0 ? (
                <>
                  <p className="text-2xl font-black tabular">{formatMoney(owed.owed, gym.currency)}</p>
                  <p className="mt-1 text-xs text-ink-3 leading-relaxed">
                    Across {owed.unpaid.length} booking{owed.unpaid.length === 1 ? '' : 's'}. This gym takes cash in
                    person — pay when you next come in and the desk will mark it off.
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-3">Nothing outstanding. You are all square.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Your membership" dense icon={<Ticket size={16} className="text-ink-3" />} />
            <div className="px-4 pb-4 pt-1">
              {membership && plan ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{plan.name}</p>
                    <Badge tone={membership.payment === 'paid' ? 'success' : 'warn'} size="sm">
                      {membership.payment === 'paid' ? 'Paid' : 'Unpaid'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    Runs to {membership.end_date} · member code {membership.member_code}
                  </p>
                  <p className="mt-1 text-xs text-ink-3">
                    {plan.includes_classes ? 'Classes are included.' : 'Classes are charged per drop-in.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink-3">
                  No active membership. You can still book classes as a drop-in and pay cash at the desk.
                </p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Pricing"
            subtitle={`Paid in cash at the desk · quoted in ${gym.currency}`}
            dense
          />
          <div className="p-4 pt-2">
            {gymPlans.length === 0 ? (
              <p className="text-sm text-ink-3">This gym has not published pricing yet.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {gymPlans.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line bg-surface-2/50 p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{p.name}</p>
                      <p className="font-black tabular text-brand-text">{formatMoney(p.price, p.currency)}</p>
                    </div>
                    <p className="text-2xs text-ink-3">
                      per month{p.months > 1 ? `, on a ${p.months}-month term` : ''}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-1.5 text-2xs text-ink-2">
                          <Check size={11} className="mt-0.5 shrink-0 text-success" aria-hidden />{perk}
                        </li>
                      ))}
                    </ul>
                    {p.includes_classes && <Badge tone="brand" size="sm" className="mt-2">Classes included</Badge>}
                    {!membership && (
                      <Button
                        size="sm" variant="outline" block className="mt-2.5"
                        loading={taking === p.id}
                        onClick={async () => {
                          setTaking(p.id);
                          try {
                            await takeMembership(p.id);
                            toast.success(
                              'Membership started',
                              `${formatMoney(p.price * p.months, p.currency)} to pay in cash at the desk.`,
                            );
                          } catch (err) {
                            toast.error('Could not start it', err instanceof Error ? err.message : undefined);
                          } finally { setTaking(null); }
                        }}
                      >
                        Take this plan
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-2xs text-ink-3 leading-relaxed">
              FitHub does not take payment. Taking a plan starts it straight away and puts it on the desk's
              list to settle — you pay the gym in cash when you next come in, and they mark it off here.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- no gym yet ---------------- */

function NoGym() {
  const gyms = useData((s) => s.gyms);
  const joinGymByCode = useData((s) => s.joinGymByCode);
  const createGym = useData((s) => s.createGym);

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [creating, setCreating] = useState(false);

  // Shown live as the code is typed, so a wrong code is obvious before submitting.
  const preview = useMemo(() => {
    if (code.replace(/[^a-z0-9]/gi, '').length < 3) return null;
    return gyms.find((g) => g.join_code.replace(/[^A-Z0-9]/g, '') === code.toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null;
  }, [code, gyms]);

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        eyebrow="My gym"
        title="Join a gym, or set one up"
        subtitle="FitHub works on its own. Connecting a gym adds its timetable, its pricing and class booking."
      />

      <Card>
        <CardHeader title="Join your gym" subtitle="Enter the code your gym gave you" dense icon={<KeyRound size={16} className="text-ink-3" />} />
        <form
          className="p-4 pt-2 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setJoinError(null);
            setJoining(true);
            try {
              const gym = await joinGymByCode(code);
              toast.success('Joined', `You are now a member of ${gym.name}.`);
            } catch (err) {
              setJoinError(err instanceof Error ? err.message : 'Could not join that gym.');
            } finally {
              setJoining(false);
            }
          }}
        >
          <Input
            label="Join code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. IRON-K42"
            autoCapitalize="characters"
            error={joinError ?? undefined}
            className="font-mono tracking-widest"
          />
          {preview && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/25 p-3">
              <p className="text-sm font-semibold">{preview.name}</p>
              {preview.address && <p className="text-2xs text-ink-3">{preview.address}</p>}
            </div>
          )}
          <Button type="submit" block loading={joining} disabled={code.trim().length < 3}>Join</Button>
          <p className="text-2xs text-ink-3 leading-relaxed">
            Gyms are not listed publicly. The only way in is a code from the gym itself.
          </p>
        </form>
      </Card>

      <Card>
        <CardHeader title="I run a gym" subtitle="Set your gym up on FitHub" dense icon={<Store size={16} className="text-ink-3" />} />
        <form
          className="p-4 pt-2 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setCreating(true);
            try {
              const gym = await createGym({ name, currency });
              toast.success('Gym created', `Your join code is ${formatJoinCode(gym.join_code)}.`);
            } catch (err) {
              toast.error('Could not create the gym', err instanceof Error ? err.message : undefined);
            } finally {
              setCreating(false);
            }
          }}
        >
          <Input label="Gym name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Iron House Gym" required />
          <div>
            <label htmlFor="gym-currency" className="block text-sm font-medium mb-1.5">Currency</label>
            <select
              id="gym-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
            >
              {GYM_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" block variant="secondary" loading={creating} disabled={name.trim().length < 2}>
            Create my gym
          </Button>
          <p className="text-2xs text-ink-3 leading-relaxed">
            This makes you the manager of a new gym and gives you a join code to hand out. You can add your
            logo, photos, pricing and timetable straight afterwards.
          </p>
        </form>
      </Card>
    </div>
  );
}
