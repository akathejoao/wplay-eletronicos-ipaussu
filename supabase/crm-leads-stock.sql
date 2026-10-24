-- Migration: Support Stock, Pix Price, Installments and Leads/Follow-up

-- 1. Add stock and pricing columns to products table if not present
alter table if exists public.products
  add column if not exists price_pix numeric(10,2) check (price_pix is null or price_pix >= 0),
  add column if not exists installments text default null check (installments is null or char_length(installments) <= 80),
  add column if not exists stock_quantity integer default null check (stock_quantity is null or stock_quantity >= 0);

-- 2. Create customer leads table for CRM & follow-up
create table if not exists public.customer_leads (
  id text primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  whatsapp text not null check (char_length(whatsapp) between 8 and 30),
  product_name text not null check (char_length(product_name) between 1 and 120),
  product_id text default null,
  variant_chosen text default null,
  notes text default '',
  status text not null default 'novo' check (status in ('novo', 'em_negociacao', 'fechado', 'aguardando_reposicao')),
  estimated_value numeric(10,2) default null,
  last_follow_up_at timestamptz default null
);

-- Indexes for CRM queries
create index if not exists customer_leads_created_idx on public.customer_leads(created_at desc);
create index if not exists customer_leads_status_idx on public.customer_leads(status);
create index if not exists customer_leads_whatsapp_idx on public.customer_leads(whatsapp);

-- 3. Security policies for customer_leads
alter table public.customer_leads enable row level security;

-- Public can submit new leads (e.g. from checkout or interest form)
drop policy if exists "Public can insert customer leads" on public.customer_leads;
create policy "Public can insert customer leads" on public.customer_leads
  for insert to anon, authenticated
  with check (char_length(name) >= 1 and char_length(whatsapp) >= 8);

-- Only store owners can inspect, update or delete leads
drop policy if exists "Store owners can manage leads" on public.customer_leads;
create policy "Store owners can manage leads" on public.customer_leads
  for all to authenticated
  using ((select private.is_store_owner()))
  with check ((select private.is_store_owner()));

-- 4. Create push notification campaigns table
create table if not exists public.push_campaigns (
  id text primary key,
  created_at timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 250),
  target_url text not null default '/',
  sent_count integer not null default 0
);

alter table public.push_campaigns enable row level security;

drop policy if exists "Store owners can manage push campaigns" on public.push_campaigns;
create policy "Store owners can manage push campaigns" on public.push_campaigns
  for all to authenticated
  using ((select private.is_store_owner()))
  with check ((select private.is_store_owner()));
