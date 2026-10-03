-- LinkMind 数据库 Schema（Neon Postgres）
-- 应用方式: DATABASE_URL=postgres://... npx tsx scripts/apply-schema.ts

create extension if not exists "pgcrypto";

-- 用户表（自建认证，替代 Supabase Auth）
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- 登录会话（httpOnly Cookie 中的 token 指向此表）
create table if not exists public.sessions (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_user_id
  on public.sessions (user_id);

create index if not exists idx_sessions_expires_at
  on public.sessions (expires_at);

-- 收藏表
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  url text not null,
  content text not null,
  summary text not null default '',
  outline jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 同一用户下 URL 去重（应用层依赖 ON CONFLICT (user_id, url)）
create unique index if not exists bookmarks_user_url_key
  on public.bookmarks (user_id, url);

create index if not exists idx_bookmarks_created_at
  on public.bookmarks (created_at desc);
