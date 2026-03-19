-- Atividade auth web: vinculo entre Supabase Auth e app_users

alter table if exists public.app_users
  add column if not exists auth_user_id uuid;

alter table if exists public.app_users
  add column if not exists auth_email text;

create unique index if not exists idx_app_users_auth_user_id
  on public.app_users(auth_user_id);

create index if not exists idx_app_users_auth_email
  on public.app_users(auth_email)
  where auth_email is not null;
