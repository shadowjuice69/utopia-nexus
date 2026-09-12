create table if not exists public.spartan_security_sessions (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text,
  session_id uuid not null default gen_random_uuid(),
  ip_address inet not null,
  user_agent text,
  dashboard_route text,
  success boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_spartan_security_sessions_ip on public.spartan_security_sessions(ip_address);
create index if not exists idx_spartan_security_sessions_discord on public.spartan_security_sessions(discord_user_id);
create index if not exists idx_spartan_security_sessions_created on public.spartan_security_sessions(created_at desc);

create table if not exists public.spartan_ip_blocks (
  id uuid primary key default gen_random_uuid(),
  ip_address inet not null unique,
  status text not null default 'active' check (status in ('active','revoked')),
  reason text,
  created_by_discord_id text,
  created_at timestamptz not null default now(),
  revoked_by_discord_id text,
  revoked_at timestamptz
);

create index if not exists idx_spartan_ip_blocks_status on public.spartan_ip_blocks(status);

create table if not exists public.spartan_security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  discord_user_id text,
  ip_address inet,
  actor_discord_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_spartan_security_events_created on public.spartan_security_events(created_at desc);
create index if not exists idx_spartan_security_events_ip on public.spartan_security_events(ip_address);

alter table public.spartan_security_sessions enable row level security;
alter table public.spartan_ip_blocks enable row level security;
alter table public.spartan_security_events enable row level security;

comment on table public.spartan_security_sessions is 'Fresh Spartan web/dashboard security session telemetry. IP is security metadata; Discord/Spartan identity remains authoritative.';
comment on table public.spartan_ip_blocks is 'Fresh Spartan system-wide network access blocks.';
comment on table public.spartan_security_events is 'Fresh Spartan security audit trail.';
