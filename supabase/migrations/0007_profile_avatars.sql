-- Small client-compressed profile photos. The application crops uploads to a
-- 384px JPEG before saving, so this text column never holds the original phone
-- image. Keeping it on profiles makes avatars available everywhere a profile
-- is already visible without making the private progress-photo bucket public.

alter table public.profiles
  add column if not exists avatar_data_url text;

alter table public.profiles
  drop constraint if exists profiles_avatar_data_url_size,
  add constraint profiles_avatar_data_url_size check (
    avatar_data_url is null
    or (
      length(avatar_data_url) <= 700000
      and avatar_data_url like 'data:image/jpeg;base64,%'
    )
  );
