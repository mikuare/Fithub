-- ============================================================================
-- FitHub — schema
-- Column names match src/types/index.ts exactly so the Supabase adapter can
-- upsert domain objects without any mapping layer.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
do $$ begin
  create type app_role as enum ('member','trainer','staff','manager','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gender_t as enum ('male','female','other','prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type experience_t as enum ('beginner','intermediate','advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type units_t as enum ('metric','imperial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_kind_t as enum ('lose_fat','build_muscle','gain_strength','improve_endurance','general_fitness','mobility','maintain');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status_t as enum ('starting','improving','on_track','needs_attention','achieved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type session_status_t as enum ('scheduled','in_progress','completed','skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status_t as enum ('active','expiring','expired','frozen','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type equipment_status_t as enum ('available','in_use','maintenance','out_of_service');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- identity ----

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null default '',
  avatar_color  text not null default '#B9F227',
  role          app_role not null default 'member',
  gym_id        uuid,
  created_at    timestamptz not null default now(),
  onboarded     boolean not null default false,
  assessment_done boolean not null default false
);

-- Roles live in their own table so RLS policies never have to read `profiles`
-- from inside a `profiles` policy (which would recurse).
create table if not exists public.user_roles (
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     app_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ------------------------------------------------------------ gym scope ----

create table if not exists public.gyms (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  address   text not null default '',
  timezone  text not null default 'UTC',
  open_hour int not null default 6 check (open_hour between 0 and 23),
  close_hour int not null default 23 check (close_hour between 0 and 24),
  capacity  int not null default 200 check (capacity > 0)
);

alter table public.profiles
  drop constraint if exists profiles_gym_id_fkey,
  add constraint profiles_gym_id_fkey foreign key (gym_id) references public.gyms(id) on delete set null;

create table if not exists public.membership_plans (
  id       uuid primary key default gen_random_uuid(),
  gym_id   uuid not null references public.gyms(id) on delete cascade,
  name     text not null,
  price    numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  months   int not null check (months > 0),
  perks    text[] not null default '{}'
);

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  plan_id     uuid not null references public.membership_plans(id),
  status      membership_status_t not null default 'active',
  start_date  date not null,
  end_date    date not null,
  member_code text not null unique,
  auto_renew  boolean not null default true,
  check (end_date >= start_date)
);
create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_gym_status_idx on public.memberships(gym_id, status);

create table if not exists public.gym_checkins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  checked_in_at   timestamptz not null default now(),
  checked_out_at  timestamptz,
  method          text not null default 'manual' check (method in ('qr','manual','kiosk')),
  recorded_by     uuid references public.profiles(id) on delete set null,
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create index if not exists checkins_gym_time_idx on public.gym_checkins(gym_id, checked_in_at desc);
create index if not exists checkins_user_time_idx on public.gym_checkins(user_id, checked_in_at desc);

create table if not exists public.gym_equipment (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  name             text not null,
  asset_tag        text not null,
  category         text not null default '',
  location         text not null default '',
  status           equipment_status_t not null default 'available',
  last_inspection  date,
  next_maintenance date,
  notes            text not null default '',
  usage_hours      int not null default 0 check (usage_hours >= 0),
  unique (gym_id, asset_tag)
);
create index if not exists equipment_gym_status_idx on public.gym_equipment(gym_id, status);

create table if not exists public.maintenance_logs (
  id           uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.gym_equipment(id) on delete cascade,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  date         date not null,
  type         text not null check (type in ('inspection','repair','service','replacement')),
  performed_by text not null default '',
  cost         numeric(10,2),
  notes        text not null default ''
);
create index if not exists maintenance_equipment_idx on public.maintenance_logs(equipment_id, date desc);

-- -------------------------------------------------------- fitness profile --

create table if not exists public.fitness_profiles (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  first_name      text not null default '',
  gender          gender_t not null default 'prefer_not_to_say',
  birth_date      date,
  height_cm       numeric(5,1) check (height_cm is null or height_cm between 50 and 280),
  weight_kg       numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400),
  units           units_t not null default 'metric',
  experience      experience_t not null default 'beginner',
  primary_goal    goal_kind_t not null default 'general_fitness',
  secondary_goals text[] not null default '{}',
  location        text not null default 'gym',
  equipment       text[] not null default '{bodyweight}',
  days_per_week   int not null default 3 check (days_per_week between 1 and 7),
  preferred_days  int[] not null default '{}',
  preferred_time  text not null default '18:00',
  session_minutes int not null default 60 check (session_minutes between 10 and 240),
  activities      text[] not null default '{}',
  safety          jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

create table if not exists public.assessments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  taken_at              timestamptz not null default now(),
  weight_kg             numeric(5,1),
  waist_cm              numeric(5,1),
  chest_cm              numeric(5,1),
  arm_cm                numeric(5,1),
  thigh_cm              numeric(5,1),
  hip_cm                numeric(5,1),
  resting_hr            int check (resting_hr is null or resting_hr between 25 and 220),
  pushups               int check (pushups is null or pushups >= 0),
  plank_seconds         int check (plank_seconds is null or plank_seconds >= 0),
  squats_60s            int check (squats_60s is null or squats_60s >= 0),
  endurance_minutes     int,
  endurance_distance_km numeric(6,2),
  mobility_score        int check (mobility_score is null or mobility_score between 1 and 5),
  notes                 text not null default ''
);
create index if not exists assessments_user_idx on public.assessments(user_id, taken_at desc);

-- ---------------------------------------------------------------- goals ----

create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  metric        text not null,
  ref           text,
  unit          text not null default '',
  start_value   numeric(10,2) not null default 0,
  target_value  numeric(10,2) not null default 0,
  current_value numeric(10,2) not null default 0,
  direction     text not null check (direction in ('increase','decrease')),
  start_date    date not null,
  target_date   date not null,
  status        goal_status_t not null default 'starting',
  milestones    jsonb not null default '[]'::jsonb,
  achieved_at   timestamptz,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  check (target_date >= start_date)
);
create index if not exists goals_user_idx on public.goals(user_id, archived, status);

-- ------------------------------------------------------------- programs ----

create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  goal          goal_kind_t not null,
  experience    experience_t not null,
  days_per_week int not null check (days_per_week between 1 and 7),
  split         text not null default '',
  week_count    int not null default 8,
  active        boolean not null default true,
  generated     boolean not null default true,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  days          jsonb not null default '[]'::jsonb,
  notes         text not null default ''
);
create index if not exists programs_user_active_idx on public.programs(user_id, active);
-- At most one active programme per user.
create unique index if not exists programs_one_active_idx
  on public.programs(user_id) where active;

-- ------------------------------------------------------- sessions & sets ---

create table if not exists public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  program_id       uuid references public.programs(id) on delete set null,
  program_day_id   text,
  date             date not null,
  title            text not null default '',
  kind             text not null default 'custom',
  status           session_status_t not null default 'scheduled',
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  planned          jsonb not null default '[]'::jsonb,
  difficulty       int check (difficulty is null or difficulty between 1 and 5),
  feeling          text check (feeling is null or feeling in ('great','good','normal','tired','exhausted')),
  notes            text not null default '',
  est_calories     int,
  created_at       timestamptz not null default now()
);
create index if not exists sessions_user_date_idx on public.workout_sessions(user_id, date desc);
create index if not exists sessions_user_status_idx on public.workout_sessions(user_id, status);

create table if not exists public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.workout_sessions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  exercise_slug text not null,
  set_index     int not null default 0,
  weight_kg     numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  reps          int check (reps is null or reps >= 0),
  seconds       int check (seconds is null or seconds >= 0),
  distance_km   numeric(7,3) check (distance_km is null or distance_km >= 0),
  rpe           numeric(3,1) check (rpe is null or rpe between 1 and 10),
  completed     boolean not null default true,
  is_warmup     boolean not null default false,
  logged_at     timestamptz not null default now()
);
create index if not exists sets_session_idx on public.workout_sets(session_id, set_index);
create index if not exists sets_user_exercise_idx on public.workout_sets(user_id, exercise_slug);

create table if not exists public.personal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  exercise_slug  text not null,
  kind           text not null,
  value          numeric(10,2) not null,
  unit           text not null default '',
  reps           int,
  weight_kg      numeric(6,2),
  session_id     uuid references public.workout_sessions(id) on delete set null,
  achieved_at    timestamptz not null default now(),
  previous_value numeric(10,2)
);
create index if not exists records_user_idx on public.personal_records(user_id, exercise_slug, kind);

-- ------------------------------------------------- recovery & body data ----

create table if not exists public.recovery_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  sleep_hours   numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  sleep_quality int check (sleep_quality is null or sleep_quality between 1 and 5),
  energy        int check (energy is null or energy between 1 and 5),
  soreness      int check (soreness is null or soreness between 1 and 5),
  stress        int check (stress is null or stress between 1 and 5),
  mood          int check (mood is null or mood between 1 and 5),
  score         int not null default 0 check (score between 0 and 100),
  note          text not null default '',
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.body_measurements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  weight_kg     numeric(5,1),
  body_fat_pct  numeric(4,1),
  waist_cm      numeric(5,1),
  chest_cm      numeric(5,1),
  arm_cm        numeric(5,1),
  thigh_cm      numeric(5,1),
  hip_cm        numeric(5,1),
  neck_cm       numeric(5,1),
  note          text not null default '',
  unique (user_id, date)
);

-- Photos are stored in a private bucket in production; the column keeps the
-- object path (or a data URL in local mode).
create table if not exists public.progress_photos (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  date     date not null,
  pose     text not null check (pose in ('front','side','back')),
  data_url text not null,
  note     text not null default '',
  private  boolean not null default true
);
create index if not exists photos_user_idx on public.progress_photos(user_id, date desc);

-- -------------------------------------------------- habits & nutrition -----

create table if not exists public.habit_definitions (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key     text not null,
  name    text not null,
  icon    text not null default 'Circle',
  unit    text not null check (unit in ('count','ml','hours','steps','minutes','servings')),
  target  numeric(10,2) not null check (target > 0),
  active  boolean not null default true,
  color   text not null default '#B9F227',
  "order" int not null default 0,
  unique (user_id, key)
);

create table if not exists public.habit_logs (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habit_definitions(id) on delete cascade,
  date     date not null,
  value    numeric(10,2) not null default 0 check (value >= 0),
  unique (habit_id, date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, date desc);

create table if not exists public.nutrition_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  slot       text not null check (slot in ('breakfast','lunch','dinner','snack')),
  name       text not null,
  servings   numeric(6,2) not null default 1 check (servings > 0),
  calories   numeric(8,2) not null default 0 check (calories >= 0),
  protein_g  numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g    numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g      numeric(7,2) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now()
);
create index if not exists nutrition_user_date_idx on public.nutrition_logs(user_id, date desc);

create table if not exists public.nutrition_targets (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  calories   int not null default 2200 check (calories >= 0),
  protein_g  int not null default 130 check (protein_g >= 0),
  carbs_g    int not null default 240 check (carbs_g >= 0),
  fat_g      int not null default 70 check (fat_g >= 0),
  water_ml   int not null default 2500 check (water_ml >= 0),
  manual     boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------- engagement --------

create table if not exists public.user_achievements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null,
  earned_at      timestamptz,
  progress       numeric(4,3) not null default 0 check (progress between 0 and 1),
  unique (user_id, achievement_id)
);

create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  icon        text not null default 'Flag',
  metric      text not null,
  target      numeric(10,2) not null check (target > 0),
  unit        text not null default '',
  start_date  date not null,
  end_date    date not null,
  scope       text not null default 'global' check (scope in ('global','gym','friends','personal')),
  gym_id      uuid references public.gyms(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  check (end_date >= start_date)
);

create table if not exists public.challenge_members (
  id             uuid primary key default gen_random_uuid(),
  challenge_id   uuid not null references public.challenges(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  progress       numeric(12,2) not null default 0,
  completed_at   timestamptz,
  on_leaderboard boolean not null default false,
  unique (challenge_id, user_id)
);
create index if not exists challenge_members_user_idx on public.challenge_members(user_id);

create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.feed_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('workout','record','achievement','challenge','note')),
  title      text not null,
  body       text not null default '',
  ref_id     text,
  created_at timestamptz not null default now(),
  reactions  jsonb not null default '{}'::jsonb
);
create index if not exists feed_user_idx on public.feed_posts(user_id, created_at desc);

-- ------------------------------------------------------------ coaching -----

create table if not exists public.trainer_clients (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  client_id  uuid not null references public.profiles(id) on delete cascade,
  since      date not null default current_date,
  active     boolean not null default true,
  focus      text not null default '',
  unique (trainer_id, client_id),
  check (trainer_id <> client_id)
);
create index if not exists trainer_clients_client_idx on public.trainer_clients(client_id) where active;

create table if not exists public.trainer_notes (
  id                uuid primary key default gen_random_uuid(),
  trainer_id        uuid not null references public.profiles(id) on delete cascade,
  client_id         uuid not null references public.profiles(id) on delete cascade,
  body              text not null,
  created_at        timestamptz not null default now(),
  visible_to_client boolean not null default true
);
create index if not exists trainer_notes_client_idx on public.trainer_notes(client_id, created_at desc);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_key text not null,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists messages_thread_idx on public.messages(thread_key, created_at);

-- ------------------------------------------------------------ platform -----

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  href       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

create table if not exists public.user_preferences (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  theme          text not null default 'dark' check (theme in ('dark','light','system')),
  units          units_t not null default 'metric',
  week_starts_on int not null default 1 check (week_starts_on in (0,1)),
  notifications  jsonb not null default '{}'::jsonb,
  privacy        jsonb not null default '{}'::jsonb,
  workout        jsonb not null default '{}'::jsonb,
  reduced_motion boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references public.profiles(id) on delete cascade,
  actor_email text not null default '',
  action      text not null,
  entity      text not null,
  entity_id   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_actor_idx on public.audit_logs(actor_id, created_at desc);

-- ------------------------------------------------------------ triggers -----

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists fitness_profiles_touch on public.fitness_profiles;
create trigger fitness_profiles_touch before update on public.fitness_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

drop trigger if exists nutrition_targets_touch on public.nutrition_targets;
create trigger nutrition_targets_touch before update on public.nutrition_targets
  for each row execute function public.touch_updated_at();

-- Creating a profile automatically grants the matching row in user_roles, so
-- role checks in RLS never have to read `profiles`.
create or replace function public.sync_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.user_roles where user_id = new.id;
  insert into public.user_roles(user_id, role) values (new.id, new.role)
    on conflict do nothing;
  return new;
end $$;

drop trigger if exists profiles_sync_role on public.profiles;
create trigger profiles_sync_role after insert or update of role on public.profiles
  for each row execute function public.sync_user_role();
