-- Migration: Web Push Subscriptions and Campaigns for WPlay

-- 1. Create table for push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookup and deduplication
create index if not exists push_subscriptions_endpoint_idx on public.push_subscriptions(endpoint);
create index if not exists push_subscriptions_created_idx on public.push_subscriptions(created_at desc);

-- 2. Row Level Security (RLS)
alter table public.push_subscriptions enable row level security;

-- Public can register/update their subscription
drop policy if exists "Public can insert push subscriptions" on public.push_subscriptions;
create policy "Public can insert push subscriptions" on public.push_subscriptions
  for insert to anon, authenticated
  with check (char_length(endpoint) > 10 and char_length(p256dh) > 0 and char_length(auth) > 0);

drop policy if exists "Public can update push subscriptions" on public.push_subscriptions;
create policy "Public can update push subscriptions" on public.push_subscriptions
  for update to anon, authenticated
  using (true)
  with check (char_length(endpoint) > 10);

-- Only store owners can read and delete push subscriptions
drop policy if exists "Store owners can manage push subscriptions" on public.push_subscriptions;
create policy "Store owners can manage push subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select private.is_store_owner()))
  with check ((select private.is_store_owner()));

-- 3. Push Campaigns enhancement (support image_url)
create table if not exists public.push_campaigns (
  id text primary key,
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 250),
  target_url text not null default '/',
  image_url text default null,
  sent_count integer not null default 0
);

alter table if exists public.push_campaigns
  add column if not exists image_url text default null;

alter table public.push_campaigns enable row level security;

drop policy if exists "Store owners can manage push campaigns" on public.push_campaigns;
create policy "Store owners can manage push campaigns" on public.push_campaigns
  for all to authenticated
  using ((select private.is_store_owner()))
  with check ((select private.is_store_owner()));
