-- Run this in the Supabase SQL Editor
create table if not exists public.batch_jobs (
  id          uuid primary key default gen_random_uuid(),
  username    text not null,
  game_urls   jsonb not null default '[]',
  status      text not null default 'pending'
                check (status in ('pending','processing','completed','failed')),
  result      jsonb,
  created_at  timestamptz not null default now()
);

-- Index for the worker's polling query
create index if not exists batch_jobs_status_created
  on public.batch_jobs (status, created_at asc);

-- Index for per-user lookups from the API
create index if not exists batch_jobs_username_created
  on public.batch_jobs (username, created_at desc);

-- Enable Row Level Security (RLS) — service role key bypasses this
alter table public.batch_jobs enable row level security;
