alter table public.profiles
  add column if not exists platform text check (platform in ('mac', 'windows')),
  add column if not exists platform_updated_at timestamptz;

comment on column public.profiles.platform is 'Customer OS: mac or windows, from web or desktop detection.';
