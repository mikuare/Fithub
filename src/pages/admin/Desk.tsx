import { useMemo, useState } from 'react';
import { Banknote, CalendarCheck, Store, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { useData } from '@/store/data';
import { countBookings, occurrences, takings } from '@/lib/gym/booking';
import { formatMoney } from '@/lib/gym/tenant';
import { addDays, formatClock, formatDate, relativeDay, today } from '@/lib/date';
import { toast } from '@/store/toast';

/* ============================================================
   Front desk
   The counter view: who is coming today, who still owes cash, and
   what is in the drawer. Marking a payment writes a ledger row and
   flips the booking in one action, so the two can never drift.
   ============================================================ */

export default function Desk() {
  const gym = useData((s) => s.gym);
  const gymClasses = useData((s) => s.gymClasses);
  const allBookings = useData((s) => s.allBookings);
  const allMemberships = useData((s) => s.allMemberships);
  const allGymPayments = useData((s) => s.allGymPayments);
  const plans = useData((s) => s.plans);
  const directory = useData((s) => s.directory);
  const settleInCash = useData((s) => s.settleInCash);
  const put = useData((s) => s.put);

  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map(directory.map((p) => [p.id, p.full_name]));
    return (id: string) => map.get(id) ?? 'Member';
  }, [directory]);

  const dayList = useMemo(() => {
    if (!gym) return [];
    return occurrences(
      gymClasses.filter((c) => c.gym_id === gym.id),
      countBookings(allBookings.filter((b) => b.gym_id === gym.id)),
      date,
      1,
    );
  }, [gym, gymClasses, allBookings, date]);

  if (!gym) {
    return (
      <div className="max-w-3xl">
        <PageHeader eyebrow="Gym" title="Front desk" />
        <Card>
          <EmptyState icon={<Store size={22} />} title="No gym on this account"
            body="Create a gym before using the desk." action={<Button to="/gym">Set up a gym</Button>} />
        </Card>
      </div>
    );
  }

  const drawer = takings(allGymPayments.filter((p) => p.gym_id === gym.id), date);
  const unpaidMemberships = allMemberships.filter(
    (m) => m.gym_id === gym.id && m.payment === 'unpaid' && m.status !== 'cancelled' && m.status !== 'expired',
  );

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Gym"
        title="Front desk"
        subtitle="Who is in today, and what is still owed in cash."
        actions={<Button to="/admin/gym" size="sm" variant="outline">Gym settings</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ink-3">
              <Banknote size={12} aria-hidden /> Cash taken
            </p>
            <p className="mt-1 text-2xl font-black tabular">{formatMoney(drawer, gym.currency)}</p>
            <p className="text-2xs text-ink-3">{relativeDay(date)}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ink-3">
              <CalendarCheck size={12} aria-hidden /> Booked in
            </p>
            <p className="mt-1 text-2xl font-black tabular">
              {dayList.reduce((total, o) => total + o.booked, 0)}
            </p>
            <p className="text-2xs text-ink-3">across {dayList.length} class{dayList.length === 1 ? '' : 'es'}</p>
          </div>
        </Card>
        <Card className={unpaidMemberships.length ? 'border-warn/40' : undefined}>
          <div className="p-4">
            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ink-3">
              <Wallet size={12} aria-hidden /> Unpaid memberships
            </p>
            <p className="mt-1 text-2xl font-black tabular">{unpaidMemberships.length}</p>
            <p className="text-2xs text-ink-3">waiting to be settled</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3].map((offset) => {
          const d = addDays(today(), offset);
          return (
            <Button key={d} size="sm" variant={d === date ? 'secondary' : 'ghost'} onClick={() => setDate(d)}>
              {relativeDay(d)}
            </Button>
          );
        })}
        <span className="text-2xs text-ink-3">{formatDate(date, 'medium')}</span>
      </div>

      {dayList.length === 0 ? (
        <Card>
          <EmptyState compact icon={<CalendarCheck size={20} />} title="No classes on this day"
            body="Nothing is scheduled. Add classes on the gym settings page." />
        </Card>
      ) : (
        <div className="space-y-3">
          {dayList.map((o) => {
            const rows = allBookings
              .filter((b) => b.class_id === o.gymClass.id && b.date === o.date && b.status !== 'cancelled')
              .sort((a, b) => nameOf(a.user_id).localeCompare(nameOf(b.user_id)));
            return (
              <Card key={o.key}>
                <CardHeader
                  title={o.gymClass.name}
                  subtitle={`${formatClock(o.gymClass.start_time)} · ${o.booked}/${o.capacity} booked`}
                  dense
                  icon={<Users size={16} className="text-ink-3" />}
                />
                {rows.length === 0 ? (
                  <p className="px-4 pb-4 pt-1 text-sm text-ink-3">Nobody booked in yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {rows.map((b) => (
                      <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{nameOf(b.user_id)}</p>
                          <p className="text-2xs text-ink-3">
                            {b.payment === 'waived' ? 'Included with membership'
                              : b.payment === 'paid' ? 'Paid in cash'
                              : `${formatMoney(b.amount, b.currency)} due`}
                          </p>
                        </div>
                        <Badge
                          tone={b.status === 'attended' ? 'success' : b.status === 'no_show' ? 'danger' : 'muted'}
                          size="sm"
                        >
                          {b.status === 'attended' ? 'Attended' : b.status === 'no_show' ? 'No-show' : 'Booked'}
                        </Badge>
                        {b.payment === 'unpaid' && (
                          <Button
                            size="sm" variant="outline" icon={<Banknote size={13} />}
                            loading={busy === b.id}
                            onClick={async () => {
                              setBusy(b.id);
                              try {
                                await settleInCash({ kind: 'class', refId: b.id, memberId: b.user_id, amount: b.amount });
                                toast.success('Cash taken', `${formatMoney(b.amount, b.currency)} from ${nameOf(b.user_id)}.`);
                              } catch (err) {
                                toast.error('Could not record it', err instanceof Error ? err.message : undefined);
                              } finally { setBusy(null); }
                            }}
                          >
                            Take {formatMoney(b.amount, b.currency)}
                          </Button>
                        )}
                        {b.status === 'booked' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => void put('class_bookings', { ...b, status: 'attended' })}>
                              Attended
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void put('class_bookings', { ...b, status: 'no_show' })}>
                              No-show
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {unpaidMemberships.length > 0 && (
        <Card className="border-warn/30">
          <CardHeader title="Memberships owing" subtitle="Settle when the member is at the desk" dense icon={<Wallet size={16} className="text-warn" />} />
          <ul className="divide-y divide-line">
            {unpaidMemberships.map((m) => {
              const plan = plans.find((p) => p.id === m.plan_id);
              const amount = plan ? plan.price * plan.months : 0;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{nameOf(m.user_id)}</p>
                    <p className="text-2xs text-ink-3">
                      {plan?.name ?? 'Membership'} · {m.start_date} to {m.end_date}
                    </p>
                  </div>
                  <Button
                    size="sm" variant="outline" icon={<Banknote size={13} />}
                    loading={busy === m.id}
                    onClick={async () => {
                      setBusy(m.id);
                      try {
                        await settleInCash({ kind: 'membership', refId: m.id, memberId: m.user_id, amount });
                        toast.success('Cash taken', `${formatMoney(amount, gym.currency)} from ${nameOf(m.user_id)}.`);
                      } catch (err) {
                        toast.error('Could not record it', err instanceof Error ? err.message : undefined);
                      } finally { setBusy(null); }
                    }}
                  >
                    Take {formatMoney(amount, gym.currency)}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
