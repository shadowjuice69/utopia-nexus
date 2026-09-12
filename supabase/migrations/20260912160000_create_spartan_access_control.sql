create table if not exists public.spartan_access (
  discord_user_id text primary key,
  username text,
  status text not null default 'pending' check (status in ('pending','active','suspended','revoked')),
  role text not null default 'member' check (role in ('member','admin','owner')),
  registration_id uuid default gen_random_uuid(),
  granted_by text,
  granted_at timestamptz,
  disabled_by text,
  disabled_at timestamptz,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_spartan_access_status on public.spartan_access(status);
create index if not exists idx_spartan_access_role on public.spartan_access(role);
create table if not exists public.spartan_access_events (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  action text not null check (action in ('registered','granted','suspended','revoked','restored','denied','bot_revoked')),
  actor_type text not null check (actor_type in ('user','admin','owner','bot','system')),
  actor_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_spartan_access_events_user on public.spartan_access_events(discord_user_id, created_at desc);
alter table public.spartan_access enable row level security;
alter table public.spartan_access_events enable row level security;
revoke all on public.spartan_access from anon, authenticated;
revoke all on public.spartan_access_events from anon, authenticated;
