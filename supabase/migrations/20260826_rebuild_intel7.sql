create table if not exists public.intel7_messages (
  id bigserial primary key,
  discord_message_id text not null unique,
  channel_id text not null,
  channel_type text not null,
  guild_id text,
  author_id text,
  author_name text,
  content text not null,
  message_created_at timestamptz,
  received_at timestamptz not null default now(),
  kd_code text not null default '6:9',
  parsed boolean not null default false
);

create index if not exists intel7_messages_channel_idx on public.intel7_messages(channel_type, message_created_at desc);
create index if not exists intel7_messages_kd_idx on public.intel7_messages(kd_code, received_at desc);

create table if not exists public.intel7_events (
  id bigserial primary key,
  discord_message_id text not null unique references public.intel7_messages(discord_message_id) on delete cascade,
  channel_type text not null,
  event_type text not null,
  kd_code text not null default '6:9',
  province_name text,
  province_kd text,
  target_name text,
  target_kd text,
  action text,
  quantity numeric,
  resource text,
  raw_content text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intel7_events_type_idx on public.intel7_events(event_type, created_at desc);
create index if not exists intel7_events_kd_idx on public.intel7_events(kd_code, created_at desc);

alter table public.intel7_messages enable row level security;
alter table public.intel7_events enable row level security;

drop policy if exists intel7_messages_read on public.intel7_messages;
create policy intel7_messages_read on public.intel7_messages for select using (true);

drop policy if exists intel7_events_read on public.intel7_events;
create policy intel7_events_read on public.intel7_events for select using (true);
