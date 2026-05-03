-- ═══════════════════════════════════════════════════════
-- CVCraft — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── RESUMES ───────────────────────────────────────────────
create table public.resumes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'Untitled Resume',
  template        text not null default 'executive',
  personal_info   jsonb not null default '{}',
  experience      jsonb not null default '[]',
  education       jsonb not null default '[]',
  skills          jsonb not null default '[]',
  certifications  jsonb not null default '[]',
  job_description text default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for fast user lookups
create index resumes_user_id_idx on public.resumes(user_id);
create index resumes_updated_at_idx on public.resumes(updated_at desc);

-- RLS
alter table public.resumes enable row level security;

create policy "Users can view own resumes"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy "Users can insert own resumes"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own resumes"
  on public.resumes for update
  using (auth.uid() = user_id);

create policy "Users can delete own resumes"
  on public.resumes for delete
  using (auth.uid() = user_id);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────
create table public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  plan                text not null default 'free' check (plan in ('free','pro','lifetime')),
  paystack_reference  text,
  amount_paid         integer,                    -- in kobo
  activated_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update subscriptions (backend only)
create policy "Service role manages subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- ── PAYMENT LOGS ──────────────────────────────────────────
create table public.payment_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reference   text not null unique,
  plan        text not null,
  amount      integer not null,              -- in kobo
  status      text not null default 'pending' check (status in ('pending','success','failed','webhook_confirmed')),
  created_at  timestamptz not null default now(),
  verified_at timestamptz
);

create index payment_logs_user_id_idx on public.payment_logs(user_id);
create index payment_logs_reference_idx on public.payment_logs(reference);

alter table public.payment_logs enable row level security;

create policy "Users can view own payment logs"
  on public.payment_logs for select
  using (auth.uid() = user_id);

create policy "Service role manages payment logs"
  on public.payment_logs for all
  using (auth.role() = 'service_role');

-- ── DOWNLOAD LOGS (rate limiting) ─────────────────────────
create table public.download_logs (
  id        uuid primary key default uuid_generate_v4(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  date      date not null default current_date,
  format    text not null default 'pdf',
  created_at timestamptz not null default now()
);

create index download_logs_user_date_idx on public.download_logs(user_id, date);

alter table public.download_logs enable row level security;

create policy "Service role manages download logs"
  on public.download_logs for all
  using (auth.role() = 'service_role');

-- ── AUTO-UPDATE updated_at ────────────────────────────────
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger resumes_updated_at
  before update on public.resumes
  for each row execute procedure public.update_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.update_updated_at();

-- ── SEED: free plan for new users ─────────────────────────
-- This trigger auto-creates a free subscription when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.subscriptions (user_id, plan)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
