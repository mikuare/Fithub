import { describe, expect, it } from 'vitest';
import {
  currencySymbol, findGymByCode, formatJoinCode, formatMoney, generateJoinCode,
  newGym, normalizeJoinCode, setupProgress, setupSteps,
} from '@/lib/gym/tenant';
import {
  BOOKING_BLOCK_MESSAGE, CANCEL_CUTOFF_HOURS, activeMembershipOn, bookingBlock,
  canCancel, cashOwed, countBookings, occurrenceKey, occurrences, priceFor, takings,
} from '@/lib/gym/booking';
import { addDays, today, weekdayOf } from '@/lib/date';
import type { ClassBooking, Gym, GymClass, Membership, MembershipPlan, Weekday } from '@/types';

const gym = (over: Partial<Gym> = {}): Gym => ({
  ...newGym({ name: 'Iron House Gym', createdBy: 'u1' }),
  id: 'gym-1', join_code: 'IRONK42', open_hour: 6, close_hour: 22, currency: 'USD', ...over,
});

const cls = (over: Partial<GymClass> = {}): GymClass => ({
  id: 'cls-1', gym_id: 'gym-1', name: 'Spin', description: '',
  weekday: 1, start_time: '18:00', duration_minutes: 45,
  capacity: 3, trainer_id: null, price: 14, active: true, ...over,
});

const booking = (over: Partial<ClassBooking> = {}): ClassBooking => ({
  id: 'bk-1', gym_id: 'gym-1', class_id: 'cls-1', user_id: 'u2',
  date: today(), status: 'booked', payment: 'unpaid', amount: 14, currency: 'USD',
  created_at: '2026-08-01T00:00:00.000Z', cancelled_at: null, ...over,
});

/** A class on a specific future date, so tests never depend on the day they run. */
const onDay = (daysAhead: number, over: Partial<GymClass> = {}) => {
  const date = addDays(today(), daysAhead);
  return { date, gymClass: cls({ weekday: weekdayOf(date) as Weekday, ...over }) };
};

describe('join codes', () => {
  it('ignores case and punctuation so a code written on paper still works', () => {
    expect(normalizeJoinCode('iron-k42')).toBe('IRONK42');
    expect(normalizeJoinCode(' IrOn K42 ')).toBe('IRONK42');
    expect(findGymByCode([gym()], 'iron k42')?.id).toBe('gym-1');
    expect(findGymByCode([gym()], 'nope')).toBeNull();
    expect(findGymByCode([gym()], '')).toBeNull();
  });

  it('builds a code from the gym name so it is recognisable', () => {
    expect(generateJoinCode('Iron House Gym')).toMatch(/^IRON[A-Z0-9]{3}$/);
  });

  it('avoids codes already in use', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const code = generateJoinCode('Iron House Gym', taken);
      expect(taken.has(code)).toBe(false);
      taken.add(code);
    }
  });

  it('keeps the random half free of characters that are misread', () => {
    // The name half keeps I and O on purpose — IRON must still read as IRON.
    for (let i = 0; i < 80; i++) {
      expect(generateJoinCode('Iron House Gym').slice(4)).not.toMatch(/[IO01]/);
    }
  });

  it('never generates an empty code, even from a name with no usable letters', () => {
    expect(generateJoinCode('!!! ???').length).toBeGreaterThanOrEqual(6);
    expect(formatJoinCode('IRONK42')).toBe('IRON-K42');
  });
});

describe('new gym', () => {
  it('is valid and usable the moment it is created', () => {
    const g = newGym({ name: '  Iron House Gym  ', createdBy: 'u1' });
    expect(g.name).toBe('Iron House Gym');
    expect(g.join_code).toBeTruthy();
    expect(g.active).toBe(true);
    expect(g.created_by).toBe('u1');
    expect(g.close_hour).toBeGreaterThan(g.open_hour);
  });

  it('tracks what is still missing without blocking the gym from working', () => {
    const bare = setupSteps(gym({ address: '', phone: '', email: '', photos: [], logo_data_url: null }), 0, 0);
    expect(setupProgress(bare)).toBe(0);
    const done = setupSteps(gym({ address: '1 Mill Lane', phone: '555', photos: ['data:x'] }), 2, 3);
    expect(setupProgress(done)).toBe(100);
  });
});

describe('money', () => {
  it('formats with the gym currency', () => {
    expect(formatMoney(14, 'USD')).toBe('$14');
    expect(formatMoney(12.5, 'GBP')).toBe('£12.50');
    expect(currencySymbol('PHP')).toBe('₱');
    // An unknown currency shows its code rather than a wrong symbol.
    expect(formatMoney(20, 'XYZ')).toBe('XYZ 20');
  });
});

describe('timetable occurrences', () => {
  it('expands weekly templates into dated occurrences in order', () => {
    const list = occurrences([cls({ weekday: 1 }), cls({ id: 'cls-2', weekday: 4, start_time: '07:30' })], {}, today(), 14);
    expect(list.length).toBe(4); // two weekdays across a fortnight
    for (let i = 1; i < list.length; i++) {
      expect(list[i].startsAt.getTime()).toBeGreaterThanOrEqual(list[i - 1].startsAt.getTime());
    }
  });

  it('leaves unpublished classes off the timetable entirely', () => {
    expect(occurrences([cls({ active: false })], {}, today(), 14)).toHaveLength(0);
  });

  it('counts bookings against the right day only', () => {
    const { date, gymClass } = onDay(3);
    const list = occurrences([gymClass], countBookings([
      booking({ id: 'b1', class_id: gymClass.id, date }),
      booking({ id: 'b2', class_id: gymClass.id, date, user_id: 'u3' }),
      booking({ id: 'b3', class_id: gymClass.id, date: addDays(date, 7), user_id: 'u4' }),
    ]), today(), 14);
    const target = list.find((o) => o.key === occurrenceKey(gymClass.id, date))!;
    expect(target.booked).toBe(2);
    expect(target.spotsLeft).toBe(1);
  });

  it('frees a cancelled spot straight away', () => {
    const { date, gymClass } = onDay(2, { capacity: 1 });
    const list = occurrences([gymClass], countBookings([
      booking({ class_id: gymClass.id, date, status: 'cancelled' }),
    ]), today(), 14);
    const target = list.find((o) => o.key === occurrenceKey(gymClass.id, date))!;
    expect(target.booked).toBe(0);
    expect(target.spotsLeft).toBe(1);
  });
});

describe('pricing', () => {
  const plan = (over: Partial<MembershipPlan> = {}): MembershipPlan => ({
    id: 'plan-1', gym_id: 'gym-1', name: 'Standard', price: 39, currency: 'USD',
    months: 6, perks: [], includes_classes: false, ...over,
  });
  const mem = (over: Partial<Membership> = {}): Membership => ({
    id: 'mem-1', user_id: 'u2', gym_id: 'gym-1', plan_id: 'plan-1', status: 'active',
    start_date: addDays(today(), -30), end_date: addDays(today(), 30),
    member_code: 'X', auto_renew: true, payment: 'paid', ...over,
  });

  it('charges a drop-in when no membership covers classes', () => {
    const p = priceFor(cls(), mem(), [plan({ includes_classes: false })]);
    expect(p.amount).toBe(14);
    expect(p.payment).toBe('unpaid');
    expect(p.reason).toMatch(/cash/i);
  });

  it('waives the price when the plan includes classes', () => {
    const p = priceFor(cls(), mem(), [plan({ includes_classes: true })]);
    expect(p.amount).toBe(0);
    expect(p.payment).toBe('waived');
  });

  it('charges a non-member the drop-in price', () => {
    expect(priceFor(cls(), null, []).payment).toBe('unpaid');
  });

  it('treats a free class as free for everyone', () => {
    expect(priceFor(cls({ price: 0 }), null, []).payment).toBe('waived');
  });

  it('only counts a membership that covers the day of the class', () => {
    const expired = mem({ start_date: addDays(today(), -400), end_date: addDays(today(), -10), status: 'expired' });
    expect(activeMembershipOn([expired], 'gym-1', today())).toBeNull();
    expect(activeMembershipOn([mem()], 'gym-1', today())?.id).toBe('mem-1');
    expect(activeMembershipOn([mem()], 'other-gym', today())).toBeNull();
  });
});

describe('booking rules', () => {
  const ctx = (bookings: ClassBooking[] = []) => ({ userId: 'u2', gym: gym(), bookings });

  it('lets a member take a free spot', () => {
    const { date, gymClass } = onDay(2);
    const [o] = occurrences([gymClass], {}, date, 1);
    expect(bookingBlock(o, ctx())).toBeNull();
  });

  it('refuses a class that has already started', () => {
    const { date, gymClass } = onDay(0, { start_time: '00:01' });
    const [o] = occurrences([gymClass], {}, date, 1);
    expect(bookingBlock(o, { ...ctx(), now: new Date(`${date}T12:00:00`) })).toBe('past');
  });

  it('refuses a full class', () => {
    const { date, gymClass } = onDay(2, { capacity: 1 });
    const [o] = occurrences([gymClass], countBookings([booking({ class_id: gymClass.id, date, user_id: 'other' })]), date, 1);
    expect(bookingBlock(o, ctx())).toBe('full');
  });

  it('refuses a second spot in the same class', () => {
    const { date, gymClass } = onDay(2);
    const mine = booking({ class_id: gymClass.id, date, user_id: 'u2' });
    const [o] = occurrences([gymClass], countBookings([mine]), date, 1);
    expect(bookingBlock(o, ctx([mine]))).toBe('already_booked');
  });

  it('lets a member rebook after cancelling', () => {
    const { date, gymClass } = onDay(2);
    const cancelled = booking({ class_id: gymClass.id, date, user_id: 'u2', status: 'cancelled' });
    const [o] = occurrences([gymClass], countBookings([cancelled]), date, 1);
    expect(bookingBlock(o, ctx([cancelled]))).toBeNull();
  });

  it('refuses a class outside opening hours', () => {
    const { date, gymClass } = onDay(2, { start_time: '23:30' });
    const [o] = occurrences([gymClass], {}, date, 1);
    expect(bookingBlock(o, ctx())).toBe('gym_closed');
  });

  it('refuses someone who has not joined the gym', () => {
    const { date, gymClass } = onDay(2);
    const [o] = occurrences([gymClass], {}, date, 1);
    expect(bookingBlock(o, { userId: 'u2', gym: null, bookings: [] })).toBe('not_a_member');
  });

  it('explains every refusal in words a member can act on', () => {
    for (const message of Object.values(BOOKING_BLOCK_MESSAGE)) {
      expect(message.length).toBeGreaterThan(15);
    }
  });

  it('closes cancellation inside the cutoff', () => {
    const { date, gymClass } = onDay(1, { start_time: '18:00' });
    const [o] = occurrences([gymClass], {}, date, 1);
    const start = o.startsAt.getTime();
    expect(canCancel(o, new Date(start - (CANCEL_CUTOFF_HOURS + 1) * 3600_000))).toBe(true);
    expect(canCancel(o, new Date(start - (CANCEL_CUTOFF_HOURS - 0.5) * 3600_000))).toBe(false);
  });
});

describe('cash owed and takings', () => {
  it('totals what is still unpaid, ignoring cancelled and waived', () => {
    const summary = cashOwed([
      booking({ id: 'a', payment: 'unpaid', amount: 14 }),
      booking({ id: 'b', payment: 'unpaid', amount: 12 }),
      booking({ id: 'c', payment: 'paid', amount: 14 }),
      booking({ id: 'd', payment: 'waived', amount: 0 }),
      booking({ id: 'e', payment: 'unpaid', amount: 99, status: 'cancelled' }),
    ], 'USD');
    expect(summary.owed).toBe(26);
    expect(summary.unpaid.map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('adds up a single day of cash for the drawer', () => {
    const day = today();
    expect(takings([
      { amount: 14, paid_at: `${day}T09:00:00.000Z` },
      { amount: 12, paid_at: `${day}T18:30:00.000Z` },
      { amount: 40, paid_at: `${addDays(day, -1)}T18:30:00.000Z` },
    ], day)).toBe(26);
  });
});
