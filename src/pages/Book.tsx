import { useMemo, useState } from 'react';
import { CalendarDays, Clock, Users, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { useData } from '@/store/data';
import { useAuth } from '@/store/auth';
import {
  BOOKING_BLOCK_MESSAGE, activeMembershipOn, bookingBlock, canCancel, cashOwed,
  holdsSpot, occurrences, priceFor, type Occurrence,
} from '@/lib/gym/booking';
import { formatMoney } from '@/lib/gym/tenant';
import { formatClock, formatDate, relativeDay, today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';

/* ============================================================
   Book a class
   The timetable is derived from weekly templates, so this shows
   dated occurrences rather than rows from a table. Booking never
   takes money: it reserves the spot and states what is owed in
   cash, which is how the gym actually runs.
   ============================================================ */

const HORIZON_DAYS = 14;

export default function Book() {
  const gym = useData((s) => s.gym);
  const gymClasses = useData((s) => s.gymClasses);
  const bookings = useData((s) => s.bookings);
  const bookingCounts = useData((s) => s.bookingCounts);
  const memberships = useData((s) => s.memberships);
  const plans = useData((s) => s.plans);
  const bookClass = useData((s) => s.bookClass);
  const cancelBooking = useData((s) => s.cancelBooking);
  const userId = useData((s) => s.userId);
  const profile = useAuth((s) => s.profile);

  const [busy, setBusy] = useState<string | null>(null);

  const joined = Boolean(gym && profile?.gym_id === gym.id);

  const list = useMemo(() => {
    if (!gym) return [];
    // Capacity comes from the aggregated counts, not from the bookings this
    // device can read — a member only ever sees their own.
    return occurrences(gymClasses.filter((c) => c.gym_id === gym.id), bookingCounts, today(), HORIZON_DAYS);
  }, [gym, gymClasses, bookingCounts]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of list) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return [...map.entries()];
  }, [list]);

  const mine = useMemo(
    () => bookings
      .filter((b) => holdsSpot(b) && b.date >= today())
      .sort((a, b) => a.date.localeCompare(b.date)),
    [bookings],
  );

  if (!gym || !joined) {
    return (
      <div className="max-w-3xl">
        <PageHeader eyebrow="Booking" title="Classes" />
        <Card>
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="You are not connected to a gym"
            body="Class booking comes from a gym's own timetable. Join one with its code and its classes appear here."
            action={<Button to="/gym">Join a gym</Button>}
          />
        </Card>
      </div>
    );
  }

  const membership = activeMembershipOn(memberships, gym.id, today());
  const owed = cashOwed(bookings.filter((b) => b.gym_id === gym.id), gym.currency);

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        eyebrow="Booking"
        title={`${gym.name} timetable`}
        subtitle={`The next ${HORIZON_DAYS} days. Spots are held the moment you book; cash is paid at the desk.`}
      />

      {owed.owed > 0 && (
        <Card className="border-warn/40">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm">
              <Wallet size={15} className="text-warn" aria-hidden />
              <span>
                <span className="font-bold tabular">{formatMoney(owed.owed, gym.currency)}</span> to pay at the desk,
                across {owed.unpaid.length} booking{owed.unpaid.length === 1 ? '' : 's'}.
              </span>
            </p>
            <Badge tone="warn" size="sm">Cash only</Badge>
          </div>
        </Card>
      )}

      {mine.length > 0 && (
        <Card>
          <CardHeader title="Your upcoming classes" dense />
          <ul className="divide-y divide-line">
            {mine.map((b) => {
              const gymClass = gymClasses.find((c) => c.id === b.class_id);
              const occurrence = list.find((o) => o.gymClass.id === b.class_id && o.date === b.date);
              const cancellable = occurrence ? canCancel(occurrence) : false;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{gymClass?.name ?? 'Class'}</p>
                    <p className="text-2xs text-ink-3">
                      {relativeDay(b.date)} · {gymClass ? formatClock(gymClass.start_time) : ''}
                    </p>
                  </div>
                  <Badge tone={b.payment === 'paid' ? 'success' : b.payment === 'waived' ? 'muted' : 'warn'} size="sm">
                    {b.payment === 'waived' ? 'Included' : b.payment === 'paid' ? 'Paid' : formatMoney(b.amount, b.currency)}
                  </Badge>
                  <Button
                    variant="ghost" size="sm" icon={<X size={13} />}
                    disabled={!cancellable || busy === b.id}
                    onClick={async () => {
                      setBusy(b.id);
                      try {
                        await cancelBooking(b.id);
                        toast.success('Booking cancelled', 'Your spot is back in the pool.');
                      } finally { setBusy(null); }
                    }}
                  >
                    {cancellable ? 'Cancel' : 'Too late to cancel'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {byDay.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="No classes on the timetable"
            body={`${gym.name} has not published any classes yet. Check back, or ask at the desk.`}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {byDay.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-text">
                {relativeDay(date)} <span className="text-ink-3 font-medium normal-case tracking-normal">· {formatDate(date, 'medium')}</span>
              </h2>
              <ul className="space-y-2">
                {items.map((o) => {
                  const block = bookingBlock(o, { userId: userId ?? '', gym, bookings });
                  const price = priceFor(o.gymClass, membership, plans);
                  const full = o.spotsLeft <= 0;
                  return (
                    <li key={o.key}>
                      <Card className={cn(block === 'already_booked' && 'border-brand/40', full && 'opacity-75')}>
                        <div className="flex flex-wrap items-center gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">{o.gymClass.name}</p>
                              {block === 'already_booked' && <Badge tone="brand" size="sm">Booked</Badge>}
                            </div>
                            {o.gymClass.description && (
                              <p className="mt-0.5 text-2xs text-ink-3 line-clamp-1">{o.gymClass.description}</p>
                            )}
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-3">
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} aria-hidden />
                                {formatClock(o.gymClass.start_time)} · {o.gymClass.duration_minutes} min
                              </span>
                              <span className={cn('inline-flex items-center gap-1', full && 'text-warn font-semibold')}>
                                <Users size={11} aria-hidden />
                                {o.booked}/{o.capacity} booked
                              </span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold tabular">
                              {price.amount > 0 ? formatMoney(price.amount, gym.currency) : 'Included'}
                            </p>
                            <p className="text-2xs text-ink-3">{price.amount > 0 ? 'cash at the desk' : ''}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={block ? 'outline' : 'primary'}
                            disabled={Boolean(block) || busy === o.key}
                            loading={busy === o.key}
                            onClick={async () => {
                              setBusy(o.key);
                              try {
                                await bookClass(o.gymClass.id, o.date);
                                toast.success(
                                  'Spot booked',
                                  price.amount > 0
                                    ? `${formatMoney(price.amount, gym.currency)} to pay at the desk.`
                                    : 'Included with your membership.',
                                );
                              } catch (err) {
                                toast.error('Could not book', err instanceof Error ? err.message : undefined);
                              } finally { setBusy(null); }
                            }}
                          >
                            {block === 'already_booked' ? 'Booked' : block === 'full' ? 'Full' : 'Book a spot'}
                          </Button>
                        </div>
                        {block && block !== 'already_booked' && (
                          <p className="border-t border-line px-4 py-2 text-2xs text-ink-3">
                            {BOOKING_BLOCK_MESSAGE[block]}
                          </p>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
