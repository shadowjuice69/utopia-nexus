create table if not exists public.thievery_formulas (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  success_formula text,
  gain_formula text,
  damage_formula text,
  loss_formula text,
  modifiers jsonb default '{}'::jsonb,
  source text default 'official wiki',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_thievery_formulas_operation
on public.thievery_formulas(operation);
