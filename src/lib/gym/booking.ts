import type {
  ClassBooking, Gym, GymClass, ID, ISODate, Membership, MembershipPlan, PaymentState, Weekday,
} from '@/types';
import { addDays, today, weekdayOf } from '@/lib/date';

/* ============================================================
   Class booking
   The timetable is a set of weekly templates; what members book
   is a dated occurrence of one. Occurrences are derived rather
   than stored, so a gym editing its Tuesday class does not have
   to rewrite rows for every future Tuesday.

   Money is settled in cash at the desk, so a booking is made
   first and paid later — every rule here assumes that order.
   ============================================================ */

/** How long before the start time a member may still cancel without penalty. */
export const CANCEL_CUTOFF_HOURS = 2;

export interface Occurrence {
  /** Stable identity for a class on a specific day. */
  key: string;
  gymClass: GymClass;
  date: ISODate;
  /** Local start, as a Date, for comparing against now. */
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  booked: number;
  spotsLeft: number;
}

export function occurrenceKey(classId: ID, date: ISODate): string {
  return `${classId}@${date}`;
}

function at(date: ISODate, time: string, addMinutes = 0): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h || 0, (m || 0) + addMinutes, 0, 0);
  return d;
}

/** Bookings that still hold a spot. Cancelled ones free their place immediately. */
export function holdsSpot(booking: ClassBooking): boolean {
  return booking.status !== 'cancelled';
}

/**
 * Spots taken per occurrence.
 *
 * Kept separate from the booking rows because a member may only read their own
 * bookings — under row-level security they can never see the rest — so the
 * count has to reach them as an aggregate. Deriving capacity from whatever
 * bookings happened to be loaded silently under-reports a full class.
 */
export type BookingCounts = Record<string, number>;

export function countBookings(
  bookings: Array<Pick<ClassBooking, 'class_id' | 'date' | 'status'>>,
): BookingCounts {
  const counts: BookingCounts = {};
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const key = occurrenceKey(b.class_id, b.date);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Every dated occurrence in a window, oldest first. Inactive classes are
 * dropped, because an unpublished class should vanish from the timetable
 * rather than linger as an unbookable row.
 */
export function occurrences(
  classes: GymClass[],
  counts: BookingCounts,
  from: ISODate = today(),
  days = 14,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const weekday = weekdayOf(date) as Weekday;
    for (const gymClass of classes) {
      if (!gymClass.active || gymClass.weekday !== weekday) continue;
      const key = occurrenceKey(gymClass.id, date);
      const booked = counts[key] ?? 0;
      out.push({
        key,
        gymClass,
        date,
        startsAt: at(date, gymClass.start_time),
        endsAt: at(date, gymClass.start_time, gymClass.duration_minutes),
        capacity: gymClass.capacity,
        booked,
        spotsLeft: Math.max(0, gymClass.capacity - booked),
      });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/* ---------------- pricing ---------------- */

export interface ClassPrice {
  amount: number;
  /** Covered by a membership is 'waived'; otherwise cash is owed at the desk. */
  payment: PaymentState;
  reason: string;
}

/** An active membership on the day of the class, if there is one. */
export function activeMembershipOn(
  memberships: Membership[],
  gymId: ID,
  date: ISODate,
): Membership | null {
  return memberships.find((m) =>
    m.gym_id === gymId
    && (m.status === 'active' || m.status === 'expiring')
    && m.start_date <= date
    && m.end_date >= date) ?? null;
}

/**
 * What this member owes for this class. A plan that includes classes waives
 * the drop-in price; everything else is cash at the desk.
 */
export function priceFor(
  gymClass: GymClass,
  membership: Membership | null,
  plans: MembershipPlan[],
): ClassPrice {
  if (gymClass.price <= 0) {
    return { amount: 0, payment: 'waived', reason: 'This class is free.' };
  }
  const plan = membership ? plans.find((p) => p.id === membership.plan_id) ?? null : null;
  if (plan?.includes_classes) {
    return { amount: 0, payment: 'waived', reason: `Included with your ${plan.name} membership.` };
  }
  return { amount: gymClass.price, payment: 'unpaid', reason: 'Drop-in — pay cash at the desk.' };
}

/* ---------------- rules ---------------- */

export type BookingBlock =
  | 'past' | 'full' | 'already_booked' | 'gym_closed' | 'not_a_member';

export const BOOKING_BLOCK_MESSAGE: Record<BookingBlock, string> = {
  past: 'This one has already started.',
  full: 'Every spot is taken. Check back — cancellations free a place straight away.',
  already_booked: 'You already have a spot in this one.',
  gym_closed: 'The gym is not open at this time.',
  not_a_member: 'Join the gym with its code before booking a class.',
};

/**
 * Why this member cannot take this spot, or null when they can. Returns the
 * single most useful reason rather than a list — the member only needs to know
 * what stops them right now.
 */
export function bookingBlock(
  occurrence: Occurrence,
  opts: { userId: ID; gym: Gym | null; bookings: ClassBooking[]; now?: Date },
): BookingBlock | null {
  const now = opts.now ?? new Date();
  if (!opts.gym || opts.gym.id !== occurrence.gymClass.gym_id) return 'not_a_member';

  const mine = opts.bookings.find((b) =>
    b.class_id === occurrence.gymClass.id
    && b.date === occurrence.date
    && b.user_id === opts.userId
    && holdsSpot(b));
  if (mine) return 'already_booked';

  if (occurrence.startsAt.getTime() <= now.getTime()) return 'past';

  const startHour = occurrence.startsAt.getHours();
  if (startHour < opts.gym.open_hour || startHour >= opts.gym.close_hour) return 'gym_closed';

  if (occurrence.spotsLeft <= 0) return 'full';
  return null;
}

/** True while a member may still cancel and have the spot released cleanly. */
export function canCancel(occurrence: Occurrence, now: Date = new Date()): boolean {
  const cutoff = occurrence.startsAt.getTime() - CANCEL_CUTOFF_HOURS * 3600_000;
  return now.getTime() < cutoff;
}

/* ---------------- money owed ---------------- */

export interface CashSummary {
  /** Bookings still to be settled in cash. */
  unpaid: ClassBooking[];
  owed: number;
  currency: string;
}

/**
 * What a member still owes the gym in cash. Cancelled bookings are dropped —
 * nobody should be chased for a class they did not take.
 */
export function cashOwed(bookings: ClassBooking[], currency: string): CashSummary {
  const unpaid = bookings.filter((b) => b.payment === 'unpaid' && b.status !== 'cancelled');
  return {
    unpaid,
    owed: unpaid.reduce((total, b) => total + b.amount, 0),
    currency,
  };
}

/** Takings for a day, for the desk to reconcile against the cash drawer. */
export function takings(
  payments: Array<{ amount: number; paid_at: string }>,
  date: ISODate = today(),
): number {
  return payments
    .filter((p) => p.paid_at.slice(0, 10) === date)
    .reduce((total, p) => total + p.amount, 0);
}
