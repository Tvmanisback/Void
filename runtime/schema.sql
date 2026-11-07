-- Run this once in the Supabase SQL Editor for the Void project.
create table if not exists public.void_runtime_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sandbox_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.void_runtime_sessions enable row level security;
revoke all on public.void_runtime_sessions from anon, authenticated;
grant all on public.void_runtime_sessions to service_role;
