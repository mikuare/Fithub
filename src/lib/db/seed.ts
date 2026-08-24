import type {
  Gym, GymClass, MembershipPlan, GymEquipment, MaintenanceLog, Profile, Membership,
  GymCheckin, Challenge, ID, EquipmentStatus,
} from '@/types';
import { backend } from './index';
import { seedChallenges } from '@/data/challenges';
import { uid, memberCode } from '@/lib/id';
import { addDays, nowISO, today, toISODate } from '@/lib/date';
import { colorFromString } from '@/lib/utils';

export const DEMO_GYM_ID = 'gym_fithub_central';
const SEED_FLAG = 'fithub:seeded:v1';

/* A deterministic PRNG keeps the seeded gym identical across reloads. */
function rng(seed: number) {
  let s = seed >>> 0 || 7;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const FIRST = ['Alex', 'Maya', 'John', 'Sofia', 'Liam', 'Nina', 'Marco', 'Priya', 'Daniel', 'Aisha', 'Tomas', 'Elena', 'Kofi', 'Hana', 'Ruben', 'Zara', 'Ivan', 'Leah', 'Omar', 'Grace', 'Noah', 'Yuki', 'Pablo', 'Amara', 'Felix', 'Isla', 'Diego', 'Mei', 'Samir', 'Clara', 'Jonas', 'Tara', 'Andre', 'Lina', 'Hugo', 'Rosa', 'Kai', 'Nadia', 'Theo', 'Ada'];
const LAST = ['Cruz', 'Silva', 'Novak', 'Haddad', 'Okafor', 'Rossi', 'Patel', 'Andersen', 'Kim', 'Moreau', 'Vargas', 'Brandt', 'Nakamura', 'Duarte', 'Lindqvist', 'Osei', 'Kowalski', 'Ferreira', 'Bauer', 'Marino'];

const EQUIPMENT_SEED: Array<[string, string, string]> = [
  ['Treadmill 01', 'Cardio', 'Cardio floor — row A'],
  ['Treadmill 02', 'Cardio', 'Cardio floor — row A'],
  ['Treadmill 03', 'Cardio', 'Cardio floor — row A'],
  ['Treadmill 04', 'Cardio', 'Cardio floor — row A'],
  ['Rowing Machine 01', 'Cardio', 'Cardio floor — row B'],
  ['Rowing Machine 02', 'Cardio', 'Cardio floor — row B'],
  ['Upright Bike 01', 'Cardio', 'Cardio floor — row B'],
  ['Upright Bike 02', 'Cardio', 'Cardio floor — row B'],
  ['Elliptical 01', 'Cardio', 'Cardio floor — row C'],
  ['Elliptical 02', 'Cardio', 'Cardio floor — row C'],
  ['Power Rack 01', 'Free weights', 'Strength zone — bay 1'],
  ['Power Rack 02', 'Free weights', 'Strength zone — bay 2'],
  ['Power Rack 03', 'Free weights', 'Strength zone — bay 3'],
  ['Flat Bench 01', 'Free weights', 'Strength zone — bay 1'],
  ['Flat Bench 02', 'Free weights', 'Strength zone — bay 2'],
  ['Incline Bench 01', 'Free weights', 'Strength zone — bay 3'],
  ['Deadlift Platform 01', 'Free weights', 'Strength zone — platform'],
  ['Dumbbell Rack (1–30 kg)', 'Free weights', 'Free-weight floor'],
  ['Dumbbell Rack (32–50 kg)', 'Free weights', 'Free-weight floor'],
  ['Cable Crossover', 'Machines', 'Machine floor — north'],
  ['Lat Pulldown', 'Machines', 'Machine floor — north'],
  ['Seated Row', 'Machines', 'Machine floor — north'],
  ['Leg Press', 'Machines', 'Machine floor — south'],
  ['Hack Squat', 'Machines', 'Machine floor — south'],
  ['Leg Extension', 'Machines', 'Machine floor — south'],
  ['Lying Leg Curl', 'Machines', 'Machine floor — south'],
  ['Chest Press', 'Machines', 'Machine floor — east'],
  ['Shoulder Press', 'Machines', 'Machine floor — east'],
  ['Pec Deck', 'Machines', 'Machine floor — east'],
  ['Smith Machine', 'Machines', 'Machine floor — east'],
  ['Assisted Pull-Up', 'Machines', 'Machine floor — west'],
  ['Hip Abduction', 'Machines', 'Machine floor — west'],
  ['Kettlebell Set', 'Functional', 'Functional zone'],
  ['Plyo Box Set', 'Functional', 'Functional zone'],
  ['Battle Ropes', 'Functional', 'Functional zone'],
  ['Sled Track', 'Functional', 'Functional zone'],
];

export async function seedIfEmpty(): Promise<void> {
  const db = backend();
  // Supabase seeds through supabase/migrations/0004_seed.sql — these demo rows
  // use non-uuid ids and belong to the browser database only.
  if (db.kind !== 'local') return;
  if (localStorage.getItem(SEED_FLAG)) return;
  const existing = await db.listAll('gyms');
  if (existing.length) { localStorage.setItem(SEED_FLAG, '1'); return; }

  const rand = rng(20240501);
  const gym: Gym = {
    id: DEMO_GYM_ID,
    name: 'FitHub Central',
    join_code: 'FITH-CTR',
    description: 'A full-service gym on two floors, with a class studio, free weights and a quiet training room.',
    address: '18 Riverside Way, Level 2',
    phone: '+1 555 0142',
    email: 'hello@fithubcentral.example',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    open_hour: 6,
    close_hour: 23,
    capacity: 220,
    currency: 'USD',
    logo_data_url: null,
    photos: [],
    created_by: null,
    active: true,
    created_at: new Date(Date.now() - 400 * 86_400_000).toISOString(),
  };

  const plans: MembershipPlan[] = [
    { id: 'plan_flex', gym_id: gym.id, name: 'Flex Monthly', price: 45, currency: 'USD', months: 1, perks: ['Full gym access', 'Cancel anytime'], includes_classes: false },
    { id: 'plan_standard', gym_id: gym.id, name: 'Standard', price: 39, currency: 'USD', months: 6, perks: ['Full gym access', 'Two guest passes', 'Class booking'], includes_classes: true },
    { id: 'plan_annual', gym_id: gym.id, name: 'Annual', price: 32, currency: 'USD', months: 12, perks: ['Full gym access', 'Unlimited classes', 'Quarterly assessment'], includes_classes: true },
    { id: 'plan_pt', gym_id: gym.id, name: 'Coached', price: 129, currency: 'USD', months: 1, perks: ['Everything in Annual', 'Weekly coaching session', 'Programme review'], includes_classes: true },
  ];

  const equipment: GymEquipment[] = EQUIPMENT_SEED.map(([name, category, location], i) => {
    const roll = rand();
    const status: EquipmentStatus = roll > 0.94 ? 'out_of_service' : roll > 0.86 ? 'maintenance' : 'available';
    const lastInspection = addDays(today(), -Math.floor(rand() * 120));
    return {
      id: `eq_${i + 1}`,
      gym_id: gym.id,
      name,
      asset_tag: `FH-${String(i + 1).padStart(3, '0')}`,
      category,
      location,
      status,
      last_inspection: lastInspection,
      next_maintenance: addDays(lastInspection, 90),
      notes: status === 'maintenance' ? 'Reported by a member — belt slipping under load.'
        : status === 'out_of_service' ? 'Awaiting replacement part from the supplier.' : '',
      usage_hours: Math.round(rand() * 2200),
    };
  });

  const maintenance: MaintenanceLog[] = equipment
    .filter((_, i) => i % 3 === 0)
    .map((e, i) => ({
      id: `ml_${i + 1}`,
      equipment_id: e.id,
      gym_id: gym.id,
      date: addDays(today(), -Math.floor(rand() * 90)),
      type: (['inspection', 'service', 'repair'] as const)[Math.floor(rand() * 3)],
      performed_by: 'Facilities team',
      cost: Math.round(rand() * 320),
      notes: 'Routine check — lubricated moving parts and verified cable tension.',
    }));

  /* A sample member cohort so gym analytics, attendance and member management
     compute from real rows rather than hard-coded numbers. These are clearly
     labelled as sample data in the admin UI. */
  const members: Profile[] = [];
  const memberships: Membership[] = [];
  const checkins: GymCheckin[] = [];

  for (let i = 0; i < 48; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)];
    const last = LAST[Math.floor(rand() * LAST.length)];
    const id: ID = `demo_${i + 1}`;
    const role = i < 4 ? 'trainer' : i < 6 ? 'staff' : 'member';
    members.push({
      id,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      full_name: `${first} ${last}`,
      avatar_color: colorFromString(id),
      role,
      gym_id: gym.id,
      created_at: new Date(Date.now() - Math.floor(rand() * 400) * 86_400_000).toISOString(),
      onboarded: true,
      assessment_done: rand() > 0.4,
    });

    if (role === 'member') {
      const plan = plans[Math.floor(rand() * 3)];
      const start = addDays(today(), -Math.floor(rand() * 330));
      const end = addDays(start, plan.months * 30);
      const daysLeft = Math.round((new Date(end).getTime() - Date.now()) / 86_400_000);
      memberships.push({
        id: uid('mem'),
        user_id: id,
        gym_id: gym.id,
        plan_id: plan.id,
        status: daysLeft < 0 ? 'expired' : daysLeft <= 21 ? 'expiring' : rand() > 0.96 ? 'frozen' : 'active',
        start_date: start,
        end_date: end,
        member_code: memberCode(),
        auto_renew: rand() > 0.35,
        payment: rand() > 0.18 ? 'paid' : 'unpaid',
      });
    }

    // Attendance history: more traffic on weekdays, peak between 17:00–20:00.
    for (let d = 29; d >= 0; d--) {
      const date = addDays(today(), -d);
      const weekday = new Date(date + 'T00:00:00').getDay();
      const base = weekday === 0 || weekday === 6 ? 0.22 : 0.42;
      if (rand() > base) continue;
      const hourRoll = rand();
      const hour = hourRoll < 0.28 ? 6 + Math.floor(rand() * 3)
        : hourRoll < 0.45 ? 11 + Math.floor(rand() * 3)
        : 17 + Math.floor(rand() * 4);
      const minute = Math.floor(rand() * 60);
      const inAt = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
      const stay = 45 + Math.floor(rand() * 60);
      const outAt = new Date(inAt.getTime() + stay * 60_000);
      const stillIn = d === 0 && outAt.getTime() > Date.now();
      checkins.push({
        id: uid('ci'),
        user_id: id,
        gym_id: gym.id,
        checked_in_at: inAt.toISOString(),
        checked_out_at: stillIn ? null : outAt.toISOString(),
        method: rand() > 0.25 ? 'qr' : 'manual',
        recorded_by: null,
      });
    }
  }

  // A week's timetable, so the booking screens have something real in them.
  const classes: GymClass[] = ([
    ['Morning HIIT', 1, '06:00', 45, 20, 12, 'Short, hard intervals to start the week.'],
    ['Spin', 1, '18:00', 45, 20, 14, 'Indoor cycling to music. Bring a towel.'],
    ['Open Mat', 2, '07:00', 60, 15, 0, 'Unstructured mat time with a coach on the floor.'],
    ['Strength Basics', 3, '18:30', 60, 12, 15, 'Squat, hinge, press and pull, coached from scratch.'],
    ['Yoga & Mobility', 4, '07:30', 50, 18, 10, 'Slow, held positions. Beginners welcome.'],
    ['Conditioning', 5, '17:30', 45, 20, 12, 'Mixed cardio and bodyweight circuits.'],
    ['Weekend Long Session', 6, '09:00', 75, 24, 12, 'A longer, easier group session.'],
  ] as const).map(([name, weekday, start, minutes, capacity, price, description], i) => ({
    id: `cls_${i + 1}`,
    gym_id: gym.id,
    name,
    description,
    weekday: weekday as GymClass['weekday'],
    start_time: start,
    duration_minutes: minutes,
    capacity,
    trainer_id: null,
    price,
    active: true,
  }));

  const challenges: Challenge[] = seedChallenges(gym.id);

  await db.upsert('gyms', gym);
  await db.upsertMany('membership_plans', plans);
  await db.upsertMany('gym_classes', classes);
  await db.upsertMany('gym_equipment', equipment);
  await db.upsertMany('maintenance_logs', maintenance);
  await db.upsertMany('profiles', members);
  await db.upsertMany('memberships', memberships);
  await db.upsertMany('gym_checkins', checkins);
  await db.upsertMany('challenges', challenges);

  localStorage.setItem(SEED_FLAG, '1');
}

/** Today's check-ins for a gym, newest first. */
export function todaysCheckins(all: GymCheckin[]): GymCheckin[] {
  const d = today();
  return all
    .filter((c) => toISODate(new Date(c.checked_in_at)) === d)
    .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
}

export function currentlyInside(all: GymCheckin[]): GymCheckin[] {
  return all.filter((c) => !c.checked_out_at && Date.now() - new Date(c.checked_in_at).getTime() < 6 * 3600_000);
}

export function nowStamp(): string {
  return nowISO();
}
