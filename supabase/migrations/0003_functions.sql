-- ============================================================================
-- FitHub — account lifecycle and integrity helpers
-- ============================================================================

/**
 * Creates the profile row the moment a user signs up, so the client never has
 * to race the auth callback. Role and name come from the sign-up metadata.
 */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted app_role;
begin
  begin
    wanted := coalesce((new.raw_user_meta_data ->> 'role')::app_role, 'member');
  exception when others then
    wanted := 'member';
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'athlete'), '@', 1)),
    wanted
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.nutrition_targets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

/**
 * Full account deletion. Everything owned by the caller is removed inside one
 * transaction, then the auth user itself — which cascades anything missed.
 * Called from the client via `supabase.rpc('delete_my_account')`.
 */
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

/**
 * Keeps membership status honest without a cron job: any read of this view
 * reflects the real date rather than a stale stored status.
 */
create or replace view public.membership_status_live as
select
  m.*,
  case
    when m.status in ('frozen','cancelled') then m.status
    when m.end_date < current_date then 'expired'::membership_status_t
    when m.end_date <= current_date + 21 then 'expiring'::membership_status_t
    else 'active'::membership_status_t
  end as live_status
from public.memberships m;

/** Aggregated gym traffic by hour, used by the analytics screen. */
create or replace function public.gym_checkins_by_hour(target_gym uuid, days int default 30)
returns table (hour int, checkins bigint)
language sql stable security definer set search_path = public as $$
  select extract(hour from c.checked_in_at)::int as hour, count(*)::bigint
  from public.gym_checkins c
  where c.gym_id = target_gym
    and c.checked_in_at >= now() - make_interval(days => days)
  group by 1
  order by 1;
$$;
