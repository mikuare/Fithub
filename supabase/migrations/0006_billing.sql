-- ============================================================================
-- FitHub — plans & billing
--
-- One subscription row per user (the table is keyed on user_id, like
-- user_preferences) plus an append-style payment history. `sandbox` stays true
-- until a real payment provider is connected.
--
-- ⚠ PRODUCTION NOTE — read before connecting Stripe / PayMongo / Xendit:
-- these policies let a signed-in user write their own billing rows, which is
-- what the sandbox checkout needs. The moment real money is involved, revoke
-- the client write policies below and drive both tables exclusively from
-- provider webhooks running with the service role; the client keeps read-only
-- access to its own rows and nothing else.
-- ============================================================================

create table if not exists public.subscriptions (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  tier                 text not null check (tier in ('free','plus','pro')),
  cycle                text not null check (cycle in ('monthly','yearly')),
  status               text not null check (status in ('active','canceled')),
  currency             text not null check (currency in ('USD','PHP')),
  price                numeric(10,2) not null check (price >= 0),
  started_at           date not null,
  current_period_end   date not null,
  cancel_at_period_end boolean not null default false,
  payment_method       jsonb,
  sandbox              boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.payment_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tier        text not null check (tier in ('plus','pro')),
  cycle       text not null check (cycle in ('monthly','yearly')),
  amount      numeric(10,2) not null check (amount >= 0),
  currency    text not null check (currency in ('USD','PHP')),
  method      jsonb not null,
  status      text not null check (status in ('paid','refunded')),
  sandbox     boolean not null default true,
  description text not null default '',
  paid_at     timestamptz not null default now()
);

create index if not exists payment_records_user_idx on public.payment_records (user_id, paid_at desc);

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.payment_records enable row level security;
alter table public.payment_records force row level security;

drop policy if exists subscriptions_own_select on public.subscriptions;
drop policy if exists subscriptions_own_write on public.subscriptions;
drop policy if exists payment_records_own_select on public.payment_records;
drop policy if exists payment_records_own_write on public.payment_records;

create policy subscriptions_own_select on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

-- Sandbox only — revoke when a real provider's webhooks take over (see header).
create policy subscriptions_own_write on public.subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy payment_records_own_select on public.payment_records for select to authenticated
  using (user_id = auth.uid());

-- Sandbox only — same caveat as above. There is deliberately no update or
-- delete beyond this blanket sandbox policy; receipts are history.
create policy payment_records_own_write on public.payment_records for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- delete_my_account: full replacement adding the two billing tables.
-- ----------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.workout_sets        where user_id = uid;
  delete from public.workout_sessions    where user_id = uid;
  delete from public.personal_records    where user_id = uid;
  delete from public.programs            where user_id = uid;
  delete from public.goals               where user_id = uid;
  delete from public.assessments         where user_id = uid;
  delete from public.recovery_logs       where user_id = uid;
  delete from public.niggles             where user_id = uid;
  delete from public.body_measurements   where user_id = uid;
  delete from public.progress_photos     where user_id = uid;
  delete from public.habit_logs          where user_id = uid;
  delete from public.habit_definitions   where user_id = uid;
  delete from public.nutrition_logs      where user_id = uid;
  delete from public.nutrition_targets   where user_id = uid;
  delete from public.user_achievements   where user_id = uid;
  delete from public.challenge_members   where user_id = uid;
  delete from public.friendships         where user_id = uid or friend_id = uid;
  delete from public.feed_posts          where user_id = uid;
  delete from public.notifications       where user_id = uid;
  delete from public.messages            where from_id = uid or to_id = uid;
  delete from public.trainer_notes       where trainer_id = uid or client_id = uid;
  delete from public.trainer_clients     where trainer_id = uid or client_id = uid;
  delete from public.memberships         where user_id = uid;
  delete from public.gym_checkins        where user_id = uid;
  delete from public.payment_records     where user_id = uid;
  delete from public.subscriptions       where user_id = uid;
  delete from public.fitness_profiles    where user_id = uid;
  delete from public.user_preferences    where user_id = uid;
  delete from public.user_roles          where user_id = uid;

  -- Audit entries are retained deliberately: they record administrative
  -- actions, and the actor reference is nulled rather than removed.
  update public.audit_logs set actor_email = '[deleted account]' where actor_id = uid;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
