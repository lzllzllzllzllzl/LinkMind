create extension if not exists "pgcrypto";

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  title text not null,
  url text not null,
  content text not null,
  summary text not null default '',
  outline jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_bookmarks_created_at
  on public.bookmarks (created_at desc);