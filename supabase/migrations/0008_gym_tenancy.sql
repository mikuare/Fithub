-- ============================================================================
-- FitHub — gym tenancy, timetable and cash booking
--
-- A gym becomes a tenant: it owns its branding, its pricing and its weekly
-- timetable, and is joined by a short code rather than being listed publicly.
--
-- Money is handled in person. Nothing here talks to a payment processor: a
-- booking is made unpaid and settled at the desk, and `gym_payments` is the
-- cash ledger that records it. `method` is a single-value enum on purpose —
-- adding card later widens it instead of reshaping the table.
-- ============================================================================

-- ------------------------------------------------------- gym branding ------

alter table public.gyms
  add column if not exists join_code     text,
  add column if not exists description   text not null default '',
  add column if not exists phone         text not null default '',
  add column if not exists email         text not null default '',
  add column if not exists currency      text not null default 'USD',
  add column if not exists logo_data_url text,
  add column if not exists photos        text[] not null default '{}',
  add column if not exists created_by    uuid references public.profiles(id) on delete set null,
  add column if not exists active        boolean not null default true,
  add column if not exists created_at    timestamptz not null default now();

-- Backfill before the not-null and unique constraints go on, so an existing
-- deployment migrates rather than failing on its own data.
update public.gyms
   set join_code = upper(regexp_replace(left(name, 4), '[^A-Za-z0-9]', '', 'g'))
                   || substr(md5(id::text), 1, 3)
 where join_code is null;

alter table public.gyms alter column join_code set not null;
create unique index if not exists gyms_join_code_key on public.gyms(upper(join_code));

-- --------------------------------------------------------- plan flag -------

alter table public.membership_plans
  add column if not exists includes_classes boolean not null default false;

-- Cash memberships settle after the fact, exactly like bookings.
do $$ begin
  create type payment_state_t as enum ('unpaid', 'paid', 'waived');
exception when duplicate_object then null;
end $$;

alter table public.memberships
  add column if not exists payment payment_state_t not null default 'unpaid';

-- --------------------------------------------------------- timetable -------

create table if not exists public.gym_classes (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  name             text not null,
  description      text not null default '',
  weekday          int not null check (weekday between 0 and 6),
  start_time       text not null,
  duration_minutes int not null check (duration_minutes > 0),
  capacity         int not null check (capacity > 0),
  trainer_id       uuid references public.profiles(id) on delete set null,
  price            numeric(10,2) not null default 0 check (price >= 0),
  active           boolean not null default true
);
create index if not exists gym_classes_gym_idx on public.gym_classes(gym_id, weekday);

do $$ begin
  create type booking_status_t as enum ('booked', 'attended', 'cancelled', 'no_show');
exception when duplicate_object then null;
end $$;

create table if not exists public.class_bookings (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  class_id     uuid not null references public.gym_classes(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  date         date not null,
  status       booking_status_t not null default 'booked',
  payment      payment_state_t not null default 'unpaid',
  amount       numeric(10,2) not null default 0 check (amount >= 0),
  currency     text not null default 'USD',
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists class_bookings_lookup_idx on public.class_bookings(class_id, date);
create index if not exists class_bookings_user_idx on public.class_bookings(user_id, date);

-- One live spot per member per occurrence. A cancelled row is excluded so the
-- same member can rebook after changing their mind.
create unique index if not exists class_bookings_one_live_spot
  on public.class_bookings(class_id, date, user_id)
  where status <> 'cancelled';

-- ------------------------------------------------------- cash ledger -------

do $$ begin
  create type gym_payment_kind_t as enum ('membership', 'class');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type gym_payment_method_t as enum ('cash');
exception when duplicate_object then null;
end $$;

create table if not exists public.gym_payments (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        gym_payment_kind_t not null,
  ref_id      uuid not null,
  amount      numeric(10,2) not null check (amount >= 0),
  currency    text not null default 'USD',
  method      gym_payment_method_t not null default 'cash',
  recorded_by uuid not null references public.profiles(id),
  paid_at     timestamptz not null default now(),
  note        text not null default ''
);
create index if not exists gym_payments_gym_day_idx on public.gym_payments(gym_id, paid_at);
create index if not exists gym_payments_user_idx on public.gym_payments(user_id);

-- --------------------------------------------------------------- rls -------

alter table public.gym_classes    enable row level security;
alter table public.class_bookings enable row level security;
alter table public.gym_payments   enable row level security;

-- The timetable is readable by any signed-in account: a prospective member
-- needs to see what is on before they join.
drop policy if exists gym_classes_read on public.gym_classes;
create policy gym_classes_read on public.gym_classes
  for select to authenticated using (true);

drop policy if exists gym_classes_manage on public.gym_classes;
create policy gym_classes_manage on public.gym_classes
  for all to authenticated
  using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- A member sees and books only their own spots; staff see the whole register.
drop policy if exists class_bookings_own on public.class_bookings;
create policy class_bookings_own on public.class_bookings
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists class_bookings_write_own on public.class_bookings;
create policy class_bookings_write_own on public.class_bookings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists class_bookings_cancel_own on public.class_bookings;
create policy class_bookings_cancel_own on public.class_bookings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists class_bookings_staff on public.class_bookings;
create policy class_bookings_staff on public.class_bookings
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Capacity has to reach a member who cannot read other people's bookings, so
-- it is exposed as an aggregate with no identities in it. security_invoker is
-- off deliberately: the view runs with definer rights over class_bookings and
-- returns nothing but a count, which is exactly what the timetable needs.
create or replace view public.class_booking_counts
with (security_invoker = off) as
  select class_id, date, count(*)::int as booked
    from public.class_bookings
   where status <> 'cancelled'
   group by class_id, date;

grant select on public.class_booking_counts to authenticated;

-- Cash is recorded by staff only. A member may read their own receipts but can
-- never write one, or the ledger would be worthless.
drop policy if exists gym_payments_read on public.gym_payments;
create policy gym_payments_read on public.gym_payments
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists gym_payments_staff on public.gym_payments;
create policy gym_payments_staff on public.gym_payments
  for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
