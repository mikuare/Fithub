-- ============================================================================
-- FitHub — Body Map: niggle journal
--
-- Muscle freshness is computed client-side from workout_sets, so the only new
-- storage the Body Map needs is the niggle journal. Niggles are health-adjacent
-- and therefore private in the strongest sense: like recovery check-ins and
-- nutrition, they are never visible to trainers, friends or staff.
-- ============================================================================

create table if not exists public.niggles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  muscle        text not null check (muscle in (
                  'chest','back','lats','shoulders','traps','biceps','triceps','forearms',
                  'core','obliques','lower_back','glutes','quads','hamstrings','calves'
                )),
  side          text not null default 'both' check (side in ('left','right','both')),
  severity      int  not null check (severity between 1 and 3),
  note          text not null default '',
  started_date  date not null,
  resolved_date date check (resolved_date is null or resolved_date >= started_date),
  created_at    timestamptz not null default now()
);

create index if not exists niggles_user_idx on public.niggles (user_id, resolved_date);

alter table public.niggles enable row level security;
alter table public.niggles force row level security;

drop policy if exists niggles_own_select on public.niggles;
drop policy if exists niggles_own_write on public.niggles;

create policy niggles_own_select on public.niggles for select to authenticated
  using (user_id = auth.uid());

create policy niggles_own_write on public.niggles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- delete_my_account must also clear the new table. Full replacement of the
-- 0003 definition with one added line, so the function stays the single
-- source of truth for account erasure.
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
