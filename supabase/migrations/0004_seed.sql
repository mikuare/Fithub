-- ============================================================================
-- FitHub — optional seed data
-- Creates one gym, its plans, a starter equipment inventory and the default
-- challenge set. Safe to run more than once.
-- ============================================================================

insert into public.gyms (id, name, address, timezone, open_hour, close_hour, capacity)
values ('11111111-1111-4111-8111-111111111111', 'FitHub Central', '18 Riverside Way, Level 2', 'UTC', 6, 23, 220)
on conflict (id) do nothing;

insert into public.membership_plans (id, gym_id, name, price, currency, months, perks) values
  ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Flex Monthly', 45, 'USD', 1,  array['Full gym access','Cancel anytime']),
  ('21111111-1111-4111-8111-111111111112', '11111111-1111-4111-8111-111111111111', 'Standard',     39, 'USD', 6,  array['Full gym access','Two guest passes','Class booking']),
  ('21111111-1111-4111-8111-111111111113', '11111111-1111-4111-8111-111111111111', 'Annual',       32, 'USD', 12, array['Full gym access','Unlimited classes','Quarterly assessment']),
  ('21111111-1111-4111-8111-111111111114', '11111111-1111-4111-8111-111111111111', 'Coached',     129, 'USD', 1,  array['Everything in Annual','Weekly coaching session','Programme review'])
on conflict (id) do nothing;

insert into public.gym_equipment (gym_id, name, asset_tag, category, location, status, last_inspection, next_maintenance, usage_hours)
select
  '11111111-1111-4111-8111-111111111111',
  item.name, item.tag, item.category, item.location, 'available',
  current_date - 30, current_date + 60, 0
from (values
  ('Treadmill 01','FH-001','Cardio','Cardio floor — row A'),
  ('Treadmill 02','FH-002','Cardio','Cardio floor — row A'),
  ('Treadmill 03','FH-003','Cardio','Cardio floor — row A'),
  ('Treadmill 04','FH-004','Cardio','Cardio floor — row A'),
  ('Rowing Machine 01','FH-005','Cardio','Cardio floor — row B'),
  ('Rowing Machine 02','FH-006','Cardio','Cardio floor — row B'),
  ('Upright Bike 01','FH-007','Cardio','Cardio floor — row B'),
  ('Upright Bike 02','FH-008','Cardio','Cardio floor — row B'),
  ('Elliptical 01','FH-009','Cardio','Cardio floor — row C'),
  ('Power Rack 01','FH-010','Free weights','Strength zone — bay 1'),
  ('Power Rack 02','FH-011','Free weights','Strength zone — bay 2'),
  ('Power Rack 03','FH-012','Free weights','Strength zone — bay 3'),
  ('Flat Bench 01','FH-013','Free weights','Strength zone — bay 1'),
  ('Flat Bench 02','FH-014','Free weights','Strength zone — bay 2'),
  ('Incline Bench 01','FH-015','Free weights','Strength zone — bay 3'),
  ('Deadlift Platform 01','FH-016','Free weights','Strength zone — platform'),
  ('Dumbbell Rack (1–30 kg)','FH-017','Free weights','Free-weight floor'),
  ('Dumbbell Rack (32–50 kg)','FH-018','Free weights','Free-weight floor'),
  ('Cable Crossover','FH-019','Machines','Machine floor — north'),
  ('Lat Pulldown','FH-020','Machines','Machine floor — north'),
  ('Seated Row','FH-021','Machines','Machine floor — north'),
  ('Leg Press','FH-022','Machines','Machine floor — south'),
  ('Hack Squat','FH-023','Machines','Machine floor — south'),
  ('Leg Extension','FH-024','Machines','Machine floor — south'),
  ('Lying Leg Curl','FH-025','Machines','Machine floor — south'),
  ('Chest Press','FH-026','Machines','Machine floor — east'),
  ('Shoulder Press','FH-027','Machines','Machine floor — east'),
  ('Pec Deck','FH-028','Machines','Machine floor — east'),
  ('Smith Machine','FH-029','Machines','Machine floor — east'),
  ('Assisted Pull-Up','FH-030','Machines','Machine floor — west')
) as item(name, tag, category, location)
on conflict (gym_id, asset_tag) do nothing;

insert into public.challenges (id, name, description, icon, metric, target, unit, start_date, end_date, scope, gym_id)
values
  ('31111111-1111-4111-8111-111111111111','30-Day Walking Challenge','Log 8,000 steps or a walk on 30 separate days. Rest days count — walking is recovery.','Footprints','habit_days',30,'days', current_date - 3,  current_date + 27, 'global', null),
  ('31111111-1111-4111-8111-111111111112','20 Workout Challenge','Complete 20 workouts this month. Any session type counts.','Dumbbell','workouts',20,'workouts', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'global', null),
  ('31111111-1111-4111-8111-111111111113','100 km Cycling Challenge','Cover 100 km on the bike — indoor or outdoor, in as many rides as you like.','Bike','distance_km',100,'km', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '2 month - 1 day')::date, 'global', null),
  ('31111111-1111-4111-8111-111111111114','30-Day Mobility Challenge','Ten minutes of mobility work on 30 days. Small, daily, and it adds up.','Sparkles','minutes',300,'minutes', current_date - 7, current_date + 23, 'global', null),
  ('31111111-1111-4111-8111-111111111115','Consistency Challenge','Hit your own weekly workout target four weeks in a row. Your target, your pace.','CalendarCheck','workouts',12,'workouts', current_date - 14, current_date + 14, 'global', null),
  ('31111111-1111-4111-8111-111111111116','Gym Summer Shape-Up','A gym-wide challenge: 250 total training minutes over four weeks.','Flame','minutes',250,'minutes', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'gym', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;
