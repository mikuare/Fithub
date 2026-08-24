-- ============================================================================
-- FitHub — tenancy fixes and role hardening
--
-- Three faults, found from live 500/403 responses:
--
--   1. challenge_members' leaderboard policy queried its own table, so every
--      read recursed and PostgREST returned 500.
--   2. Creating a gym was refused (403): gyms_manage requires is_manager, but
--      the account creating its first gym is not a manager yet.
--   3. While fixing 2 it became clear that `role` was writable by the account
--      itself — profiles_update_self allows any column, and the sync_user_role
--      trigger copies role into user_roles with definer rights. Any user could
--      make themselves admin, and sign-up offered that as a menu option.
-- ============================================================================

-- ------------------------------------------- 1. leaderboard recursion ------

/** Membership read without re-entering the policy that is asking. */
create or replace function public.in_challenge(uid uuid, challenge uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.challenge_members m
    where m.challenge_id = challenge and m.user_id = uid
  );
$$;

drop policy if exists challenge_members_leaderboard on public.challenge_members;
create policy challenge_members_leaderboard on public.challenge_members
  for select to authenticated
  using (on_leaderboard and public.in_challenge(auth.uid(), challenge_id));

-- ---------------------------------------------- 2. role escalation ---------

/**
 * `role` is not the account's to set. Changes are allowed only for an admin,
 * for a trusted server-side path that opts in for the current transaction, or
 * for a service-role connection with no auth.uid() at all.
 */
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and coalesce(current_setting('fithub.allow_role_change', true), 'off') <> 'on'
     and not public.is_admin(auth.uid())
  then
    raise exception 'Only an administrator can change an account role.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update of role on public.profiles
  for each row execute function public.guard_profile_role();

/**
 * Self-registration may only ever produce a member or a trainer. Staff and
 * manager come from a gym; admin is granted deliberately or not at all.
 */
create or replace function public.clamp_signup_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not public.is_admin(auth.uid())
     and public.role_rank(new.role) > public.role_rank('trainer')
  then
    new.role := 'member';
  end if;
  return new;
end $$;

drop trigger if exists profiles_clamp_signup_role on public.profiles;
create trigger profiles_clamp_signup_role before insert on public.profiles
  for each row execute function public.clamp_signup_role();

-- Any account that already granted itself elevated access this way keeps only
-- what a gym actually justifies: managers of a gym they created stay managers.
update public.profiles p
   set role = 'member'
 where public.role_rank(p.role) > public.role_rank('trainer')
   and not exists (select 1 from public.gyms g where g.created_by = p.id);

-- ----------------------------------------- 3. self-serve gym creation ------

-- Anyone signed in may create a gym, but only one they own. Managing an
-- existing gym still needs the manager role.
drop policy if exists gyms_create_own on public.gyms;
create policy gyms_create_own on public.gyms
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists gyms_manage on public.gyms;
create policy gyms_manage on public.gyms
  for all to authenticated
  using (public.is_manager(auth.uid()) or created_by = auth.uid())
  with check (public.is_manager(auth.uid()) or created_by = auth.uid());

/**
 * Creating a gym is what makes someone a manager — the promotion happens here
 * rather than in the client, because a client that can write its own role can
 * write any role. An account that is already more privileged keeps what it has.
 */
create or replace function public.claim_new_gym()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then return new; end if;
  perform set_config('fithub.allow_role_change', 'on', true);
  update public.profiles
     set gym_id = new.id,
         role = case
                  when public.role_rank(role) >= public.role_rank('manager') then role
                  else 'manager'::app_role
                end
   where id = new.created_by;
  return new;
end $$;

drop trigger if exists gyms_claim on public.gyms;
create trigger gyms_claim after insert on public.gyms
  for each row execute function public.claim_new_gym();

-- The gym's own pricing and timetable follow the same rule: its creator can
-- always manage them, whatever their role says.
drop policy if exists plans_manage on public.membership_plans;
create policy plans_manage on public.membership_plans
  for all to authenticated
  using (public.is_manager(auth.uid())
         or exists (select 1 from public.gyms g where g.id = gym_id and g.created_by = auth.uid()))
  with check (public.is_manager(auth.uid())
         or exists (select 1 from public.gyms g where g.id = gym_id and g.created_by = auth.uid()));

drop policy if exists gym_classes_manage on public.gym_classes;
create policy gym_classes_manage on public.gym_classes
  for all to authenticated
  using (public.is_manager(auth.uid())
         or exists (select 1 from public.gyms g where g.id = gym_id and g.created_by = auth.uid()))
  with check (public.is_manager(auth.uid())
         or exists (select 1 from public.gyms g where g.id = gym_id and g.created_by = auth.uid()));
