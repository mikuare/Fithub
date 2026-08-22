-- ============================================================================
-- FitHub — row-level security
--
-- Nothing in the client is trusted. Every table below has RLS enabled, and
-- every policy derives access from auth.uid() or from a SECURITY DEFINER
-- helper that reads `user_roles` (never `profiles`, which would recurse).
-- ============================================================================

-- ------------------------------------------------------------- helpers -----

create or replace function public.has_role(uid uuid, want app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = uid and r.role = want);
$$;

create or replace function public.role_rank(r app_role)
returns int language sql immutable as $$
  select case r
    when 'member' then 0 when 'trainer' then 1 when 'staff' then 2
    when 'manager' then 3 when 'admin' then 4 end;
$$;

/** True when the caller holds `want` or anything more privileged. */
create or replace function public.at_least(uid uuid, want app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(public.role_rank(r.role)) from public.user_roles r where r.user_id = uid)
    >= public.role_rank(want), false);
$$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.at_least(uid, 'staff');
$$;

create or replace function public.is_manager(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.at_least(uid, 'manager');
$$;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(uid, 'admin');
$$;

/** True when `trainer` currently coaches `client`. */
create or replace function public.coaches(trainer uuid, client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trainer_clients tc
    where tc.trainer_id = trainer and tc.client_id = client and tc.active
  );
$$;

/** True when two users are mutually accepted friends. */
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b) or (f.user_id = b and f.friend_id = a))
  );
$$;

-- ---------------------------------------------------- enable RLS on all -----

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','gyms','membership_plans','memberships','gym_checkins',
    'gym_equipment','maintenance_logs','fitness_profiles','assessments','goals','programs',
    'workout_sessions','workout_sets','personal_records','recovery_logs','body_measurements',
    'progress_photos','habit_definitions','habit_logs','nutrition_logs','nutrition_targets',
    'user_achievements','challenges','challenge_members','friendships','feed_posts',
    'trainer_clients','trainer_notes','messages','notifications','user_preferences','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ------------------------------------------------ owner-only collections ----
-- Personal training data. Only the owner may read or write it. Trainers do NOT
-- get access here — coaching visibility is granted explicitly further down for
-- the specific tables a coach needs.

do $$
declare t text;
begin
  foreach t in array array[
    'assessments','goals','programs','workout_sessions','workout_sets',
    'personal_records','recovery_logs','body_measurements','progress_photos',
    'habit_definitions','habit_logs','nutrition_logs','user_achievements',
    'challenge_members','feed_posts','notifications'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_write', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (user_id = auth.uid())
    $f$, t || '_own_select', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())
    $f$, t || '_own_write', t);
  end loop;
end $$;

-- Singleton-per-user tables key on user_id as the primary key.
do $$
declare t text;
begin
  foreach t in array array['fitness_profiles','nutrition_targets','user_preferences'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())
    $f$, t || '_own', t);
  end loop;
end $$;

-- ------------------------------------------------------------ profiles -----

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_staff(auth.uid())
  or public.coaches(auth.uid(), id)
  or public.are_friends(auth.uid(), id)
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Managers may administer profiles at their gym; only admins change roles,
-- which is enforced by the user_roles policies below.
drop policy if exists profiles_manage on public.profiles;
create policy profiles_manage on public.profiles for update to authenticated
using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists user_roles_admin on public.user_roles;
create policy user_roles_admin on public.user_roles for all to authenticated
using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- --------------------------------------------- coaching-visible subsets ----
-- A trainer sees programme, session, set, record and goal rows only for the
-- clients actively assigned to them. Recovery logs, nutrition, measurements
-- and progress photos are deliberately excluded.

do $$
declare t text;
begin
  foreach t in array array['programs','workout_sessions','workout_sets','personal_records','goals'] loop
    execute format('drop policy if exists %I on public.%I', t || '_trainer_read', t);
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (public.coaches(auth.uid(), user_id))
    $f$, t || '_trainer_read', t);
  end loop;
end $$;

-- Measurements reach a trainer only when the client opted in.
drop policy if exists measurements_trainer_read on public.body_measurements;
create policy measurements_trainer_read on public.body_measurements for select to authenticated
using (
  public.coaches(auth.uid(), user_id)
  and coalesce((
    select (p.privacy ->> 'share_measurements')::boolean
    from public.user_preferences p where p.user_id = body_measurements.user_id
  ), false)
);

-- ---------------------------------------------------------- gym scope ------

drop policy if exists gyms_read on public.gyms;
create policy gyms_read on public.gyms for select to authenticated using (true);

drop policy if exists gyms_manage on public.gyms;
create policy gyms_manage on public.gyms for all to authenticated
using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

drop policy if exists plans_read on public.membership_plans;
create policy plans_read on public.membership_plans for select to authenticated using (true);

drop policy if exists plans_manage on public.membership_plans;
create policy plans_manage on public.membership_plans for all to authenticated
using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

drop policy if exists memberships_own on public.memberships;
create policy memberships_own on public.memberships for select to authenticated
using (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists memberships_staff on public.memberships;
create policy memberships_staff on public.memberships for all to authenticated
using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists checkins_own on public.gym_checkins;
create policy checkins_own on public.gym_checkins for select to authenticated
using (user_id = auth.uid() or public.is_staff(auth.uid()) or public.coaches(auth.uid(), user_id));

drop policy if exists checkins_self_insert on public.gym_checkins;
create policy checkins_self_insert on public.gym_checkins for insert to authenticated
with check (user_id = auth.uid() or public.is_staff(auth.uid()));

drop policy if exists checkins_staff on public.gym_checkins;
create policy checkins_staff on public.gym_checkins for all to authenticated
using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

drop policy if exists equipment_read on public.gym_equipment;
create policy equipment_read on public.gym_equipment for select to authenticated using (true);

drop policy if exists equipment_manage on public.gym_equipment;
create policy equipment_manage on public.gym_equipment for all to authenticated
using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

drop policy if exists maintenance_read on public.maintenance_logs;
create policy maintenance_read on public.maintenance_logs for select to authenticated
using (public.is_staff(auth.uid()));

drop policy if exists maintenance_manage on public.maintenance_logs;
create policy maintenance_manage on public.maintenance_logs for all to authenticated
using (public.is_manager(auth.uid())) with check (public.is_manager(auth.uid()));

-- ---------------------------------------------------------- community ------

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select to authenticated using (true);

drop policy if exists challenges_manage on public.challenges;
create policy challenges_manage on public.challenges for all to authenticated
using (public.is_manager(auth.uid()) or created_by = auth.uid())
with check (public.is_manager(auth.uid()) or created_by = auth.uid());

-- Leaderboards only expose members who explicitly opted in.
drop policy if exists challenge_members_leaderboard on public.challenge_members;
create policy challenge_members_leaderboard on public.challenge_members for select to authenticated
using (
  on_leaderboard
  and exists (
    select 1 from public.challenge_members me
    where me.challenge_id = challenge_members.challenge_id and me.user_id = auth.uid()
  )
);

drop policy if exists friendships_own on public.friendships;
create policy friendships_own on public.friendships for all to authenticated
using (user_id = auth.uid() or friend_id = auth.uid())
with check (user_id = auth.uid());

-- Feed posts follow the author's own sharing preference.
drop policy if exists feed_friends_read on public.feed_posts;
create policy feed_friends_read on public.feed_posts for select to authenticated
using (
  public.are_friends(auth.uid(), user_id)
  and coalesce((
    select (p.privacy ->> 'share_workouts')::boolean
    from public.user_preferences p where p.user_id = feed_posts.user_id
  ), false)
);

-- ----------------------------------------------------------- coaching ------

drop policy if exists trainer_clients_read on public.trainer_clients;
create policy trainer_clients_read on public.trainer_clients for select to authenticated
using (trainer_id = auth.uid() or client_id = auth.uid() or public.is_manager(auth.uid()));

drop policy if exists trainer_clients_write on public.trainer_clients;
create policy trainer_clients_write on public.trainer_clients for all to authenticated
using (trainer_id = auth.uid() or public.is_manager(auth.uid()))
with check (
  (trainer_id = auth.uid() and public.at_least(auth.uid(), 'trainer'))
  or public.is_manager(auth.uid())
);

drop policy if exists trainer_notes_read on public.trainer_notes;
create policy trainer_notes_read on public.trainer_notes for select to authenticated
using (trainer_id = auth.uid() or (client_id = auth.uid() and visible_to_client));

drop policy if exists trainer_notes_write on public.trainer_notes;
create policy trainer_notes_write on public.trainer_notes for all to authenticated
using (trainer_id = auth.uid())
with check (trainer_id = auth.uid() and public.coaches(auth.uid(), client_id));

drop policy if exists messages_participants on public.messages;
create policy messages_participants on public.messages for select to authenticated
using (from_id = auth.uid() or to_id = auth.uid());

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
with check (from_id = auth.uid() and user_id = auth.uid());

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
using (to_id = auth.uid()) with check (to_id = auth.uid());

-- ------------------------------------------------------------- audit -------
-- Append-only: anyone signed in may write an entry about their own actions,
-- only admins may read, and nobody may update or delete.

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
with check (actor_id = auth.uid());

drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select to authenticated
using (public.is_admin(auth.uid()));

-- ------------------------------------------------------------ storage ------
-- Progress photos live in a private bucket, one folder per user id.

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

drop policy if exists "progress photos are private to their owner" on storage.objects;
create policy "progress photos are private to their owner"
on storage.objects for all to authenticated
using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
