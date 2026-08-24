import { beforeEach, describe, expect, it } from 'vitest';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { backend } from '@/lib/db';
import { idbWipe } from '@/lib/storage/idb';
import { normalizeJoinCode } from '@/lib/gym/tenant';
import { countBookings, occurrences } from '@/lib/gym/booking';
import { addDays, today, weekdayOf } from '@/lib/date';
import type { GymClass, MembershipPlan, Weekday } from '@/types';

/**
 * The tenant loop through the real store and backend: an owner creates a gym,
 * prices it, publishes a timetable and hands out a code; a member joins with
 * that code, books a class, and the desk takes the cash.
 */
describe('gym tenancy end to end', () => {
  beforeEach(async () => {
    localStorage.clear();
    await idbWipe();
    useData.getState().reset();
    useAuth.setState({ status: 'anon', profile: null, error: null, busy: false });
  });

  const signUp = async (email: string, name: string) => {
    await useAuth.getState().signUp({ email, password: 'correct-horse-9', full_name: name, role: 'member' });
    const profile = useAuth.getState().profile!;
    await useData.getState().load(profile.id, profile.role);
    return profile;
  };

  it('carries an owner from creating a gym to taking cash for a class', async () => {
    /* ---- the owner creates a gym -------------------------------------- */
    const owner = await signUp('owner@example.com', 'Sam Reed');
    const gym = await useData.getState().createGym({ name: 'Iron House Gym', currency: 'GBP' });

    expect(gym.join_code).toMatch(/^IRON/);
    expect(gym.currency).toBe('GBP');
    expect(gym.created_by).toBe(owner.id);
    // Creating a gym promotes the account that runs it.
    expect(useAuth.getState().profile!.role).toBe('manager');
    expect(useAuth.getState().profile!.gym_id).toBe(gym.id);
    expect(useData.getState().gym!.id).toBe(gym.id);

    /* ---- pricing and timetable ---------------------------------------- */
    const plan: MembershipPlan = {
      id: 'plan-x', gym_id: gym.id, name: 'Monthly', price: 30, currency: 'GBP',
      months: 1, perks: ['Full access'], includes_classes: false,
    };
    await useData.getState().put('membership_plans', plan);

    const date = addDays(today(), 2);
    const spin: GymClass = {
      id: 'cls-x', gym_id: gym.id, name: 'Spin', description: 'Indoor cycling.',
      weekday: weekdayOf(date) as Weekday, start_time: '18:00', duration_minutes: 45,
      capacity: 2, trainer_id: null, price: 8, active: true,
    };
    await useData.getState().put('gym_classes', spin);
    expect(useData.getState().gymClasses.some((c) => c.id === 'cls-x')).toBe(true);

    /* ---- a member joins with the code --------------------------------- */
    const member = await signUp('mia@example.com', 'Mia Cortez');
    expect(useData.getState().gyms.some((g) => g.id === gym.id)).toBe(true);

    const joined = await useData.getState().joinGymByCode(gym.join_code.toLowerCase());
    expect(joined.id).toBe(gym.id);
    expect(useAuth.getState().profile!.gym_id).toBe(gym.id);
    // Joining must not hand out staff powers.
    expect(useAuth.getState().profile!.role).toBe('member');

    /* ---- and books a class -------------------------------------------- */
    const booking = await useData.getState().bookClass(spin.id, date);
    expect(booking.status).toBe('booked');
    expect(booking.amount).toBe(8);
    expect(booking.currency).toBe('GBP');
    // Nothing was paid: cash is handed over at the desk, not at booking time.
    expect(booking.payment).toBe('unpaid');

    // Booking twice is idempotent rather than double-charging.
    const again = await useData.getState().bookClass(spin.id, date);
    expect(again.id).toBe(booking.id);
    expect(useData.getState().bookings.filter((b) => b.status !== 'cancelled')).toHaveLength(1);

    /* ---- the spot is really held -------------------------------------- */
    const [slot] = occurrences([spin], countBookings(useData.getState().bookings), date, 1);
    expect(slot.booked).toBe(1);
    expect(slot.spotsLeft).toBe(1);

    /* ---- the desk takes the cash -------------------------------------- */
    const staff = await signUp('desk@example.com', 'Desk Staff');
    await useAuth.getState().updateProfile({ gym_id: gym.id, role: 'staff' });
    await useData.getState().load(staff.id, 'staff');

    await useData.getState().settleInCash({
      kind: 'class', refId: booking.id, memberId: member.id, amount: 8,
    });

    const ledger = await backend().listAll('gym_payments');
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: 8, method: 'cash', kind: 'class', recorded_by: staff.id });

    // The booking and the ledger agree, because one action wrote both.
    const stored = await backend().listAll('class_bookings');
    expect(stored.find((b) => b.id === booking.id)!.payment).toBe('paid');
  });

  it('refuses a code that matches no gym, and leaves the member unattached', async () => {
    await signUp('nobody@example.com', 'No Body');
    await expect(useData.getState().joinGymByCode('NOPE-999')).rejects.toThrow(/no gym matches/i);
    expect(useAuth.getState().profile!.gym_id).toBeNull();
  });

  it('refuses to let a member join a gym that has closed its doors', async () => {
    await signUp('owner2@example.com', 'Owner Two');
    const gym = await useData.getState().createGym({ name: 'Shut Gym' });
    await useData.getState().updateGym({ active: false });

    await signUp('member2@example.com', 'Member Two');
    await expect(useData.getState().joinGymByCode(gym.join_code)).rejects.toThrow(/not accepting/i);
  });

  it('frees the spot again when a booking is cancelled', async () => {
    await signUp('owner3@example.com', 'Owner Three');
    const gym = await useData.getState().createGym({ name: 'Third Gym' });
    const date = addDays(today(), 3);
    const cls: GymClass = {
      id: 'cls-y', gym_id: gym.id, name: 'Yoga', description: '', weekday: weekdayOf(date) as Weekday,
      start_time: '09:00', duration_minutes: 60, capacity: 1, trainer_id: null, price: 0, active: true,
    };
    await useData.getState().put('gym_classes', cls);

    const booking = await useData.getState().bookClass(cls.id, date);
    // A free class needs no cash at all.
    expect(booking.payment).toBe('waived');
    expect(occurrences([cls], countBookings(useData.getState().bookings), date, 1)[0].spotsLeft).toBe(0);

    await useData.getState().cancelBooking(booking.id);
    expect(occurrences([cls], countBookings(useData.getState().bookings), date, 1)[0].spotsLeft).toBe(1);
    // History is kept rather than deleted — the gym still needs the record.
    expect(useData.getState().bookings.find((b) => b.id === booking.id)!.status).toBe('cancelled');
  });

  it('gives every gym a code that is unique once punctuation is stripped', async () => {
    await signUp('owner4@example.com', 'Owner Four');
    const codes = new Set<string>();
    for (const name of ['Iron House', 'Iron House', 'Iron House', 'Iron House']) {
      const gym = await useData.getState().createGym({ name });
      const code = normalizeJoinCode(gym.join_code);
      expect(codes.has(code)).toBe(false);
      codes.add(code);
    }
  });

  it('shows a member the real capacity, including spots they cannot read', async () => {
    const owner = await signUp('owner5@example.com', 'Owner Five');
    const gym = await useData.getState().createGym({ name: 'Busy Gym' });
    const date = addDays(today(), 2);
    const cls: GymClass = {
      id: 'cls-z', gym_id: gym.id, name: 'Spin', description: '', weekday: weekdayOf(date) as Weekday,
      start_time: '18:00', duration_minutes: 45, capacity: 3, trainer_id: null, price: 5, active: true,
    };
    await useData.getState().put('gym_classes', cls);

    for (const email of ['one@example.com', 'two@example.com']) {
      await signUp(email, email);
      await useData.getState().joinGymByCode(gym.join_code);
      await useData.getState().bookClass(cls.id, date);
    }

    // A third member opens the app fresh. Under row-level security they can
    // only read their own bookings, so capacity has to come from the counts.
    const third = await signUp('three@example.com', 'Three');
    await useData.getState().joinGymByCode(gym.join_code);
    expect(useData.getState().bookings).toHaveLength(0);

    const [slot] = occurrences([cls], useData.getState().bookingCounts, date, 1);
    expect(slot.booked).toBe(2);
    expect(slot.spotsLeft).toBe(1);

    // Their own booking fills the class without a reload.
    await useData.getState().bookClass(cls.id, date);
    const [after] = occurrences([cls], useData.getState().bookingCounts, date, 1);
    expect(after.booked).toBe(3);
    expect(after.spotsLeft).toBe(0);
    expect(third.id).toBeTruthy();
    expect(owner.id).toBeTruthy();
  });

  it('releases the counted spot when a booking is cancelled', async () => {
    await signUp('owner6@example.com', 'Owner Six');
    const gym = await useData.getState().createGym({ name: 'Cancel Gym' });
    const date = addDays(today(), 2);
    const cls: GymClass = {
      id: 'cls-c', gym_id: gym.id, name: 'Yoga', description: '', weekday: weekdayOf(date) as Weekday,
      start_time: '09:00', duration_minutes: 60, capacity: 1, trainer_id: null, price: 0, active: true,
    };
    await useData.getState().put('gym_classes', cls);
    const booking = await useData.getState().bookClass(cls.id, date);
    expect(occurrences([cls], useData.getState().bookingCounts, date, 1)[0].spotsLeft).toBe(0);
    await useData.getState().cancelBooking(booking.id);
    expect(occurrences([cls], useData.getState().bookingCounts, date, 1)[0].spotsLeft).toBe(1);
  });

  it('lets a member take a plan and leaves it for the desk to settle in cash', async () => {
    const owner = await signUp('owner7@example.com', 'Owner Seven');
    const gym = await useData.getState().createGym({ name: 'Cash Gym', currency: 'PHP' });
    const plan: MembershipPlan = {
      id: 'plan-cash', gym_id: gym.id, name: 'Monthly', price: 1200, currency: 'PHP',
      months: 1, perks: ['Full access'], includes_classes: true,
    };
    await useData.getState().put('membership_plans', plan);

    const member = await signUp('cash@example.com', 'Cash Member');
    await useData.getState().joinGymByCode(gym.join_code);
    const membership = await useData.getState().takeMembership(plan.id);

    expect(membership.status).toBe('active');
    expect(membership.payment).toBe('unpaid');
    expect(membership.member_code).toBeTruthy();

    // Taking a second plan while one is running is refused rather than stacked.
    await expect(useData.getState().takeMembership(plan.id)).rejects.toThrow(/already have an active/i);

    // Because the plan includes classes, booking one costs nothing.
    const date = addDays(today(), 2);
    const cls: GymClass = {
      id: 'cls-inc', gym_id: gym.id, name: 'Spin', description: '', weekday: weekdayOf(date) as Weekday,
      start_time: '18:00', duration_minutes: 45, capacity: 5, trainer_id: null, price: 250, active: true,
    };
    await useData.getState().put('gym_classes', cls);
    const booking = await useData.getState().bookClass(cls.id, date);
    expect(booking.payment).toBe('waived');
    expect(booking.amount).toBe(0);

    /* ---- the desk settles the membership ------------------------------ */
    const staff = await signUp('desk7@example.com', 'Desk Seven');
    await useAuth.getState().updateProfile({ gym_id: gym.id, role: 'staff' });
    await useData.getState().load(staff.id, 'staff');

    const owing = useData.getState().allMemberships.filter((m) => m.payment === 'unpaid');
    expect(owing.map((m) => m.id)).toContain(membership.id);

    await useData.getState().settleInCash({
      kind: 'membership', refId: membership.id, memberId: member.id, amount: plan.price * plan.months,
    });

    const stored = await backend().listAll('memberships');
    expect(stored.find((m) => m.id === membership.id)!.payment).toBe('paid');
    const ledger = await backend().listAll('gym_payments');
    expect(ledger.find((p) => p.ref_id === membership.id)).toMatchObject({ amount: 1200, kind: 'membership', method: 'cash' });
    expect(owner.id).toBeTruthy();
  });
});
