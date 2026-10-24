create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (char_length(category) between 1 and 48),
  description text not null default '' check (char_length(description) <= 240),
  badge text not null default '' check (char_length(badge) <= 48),
  price numeric(10,2) check (price is null or price >= 0),
  image text not null default '',
  published boolean not null default false,
  featured boolean not null default false,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products drop constraint if exists products_category_check;
alter table public.products add column if not exists badge text not null default '';
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;

create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'WPlay Eletrônicos',
  hero_headline text not null default 'Toque, escolha e chame no WhatsApp.',
  whatsapp_url text not null default 'https://wa.me/5514996747344',
  whatsapp_phone text default '5514996747344',
  instagram_url text not null default 'https://www.instagram.com/wplayeletronicosipaussu/',
  instagram_handle text not null default '@wplayeletronicosipaussu',
  city text not null default 'Ipaussu — SP',
  address_line text not null default 'R. Washington Luís, 887',
  postal_code text not null default '18950-025',
  maps_url text not null default 'https://maps.app.goo.gl/nrtpoXdpveMRe4mg9',
  hours_lines jsonb not null default '["Seg a Sex: consulte horário no WhatsApp", "Sábado: atendimento na loja e WhatsApp"]'::jsonb,
  custom_categories jsonb not null default '["Celulares", "Mobilidade", "Perfumes", "Áudio", "Acessórios"]'::jsonb,
  attendance_note text not null default 'Confirme preço, disponibilidade, formas de pagamento e entrega direto no WhatsApp.',
  updated_at timestamptz not null default now()
);

alter table public.store_settings add column if not exists store_name text not null default 'WPlay Eletrônicos';
alter table public.store_settings add column if not exists hero_headline text not null default 'Toque, escolha e chame no WhatsApp.';
alter table public.store_settings add column if not exists whatsapp_phone text;
alter table public.store_settings alter column whatsapp_url set default 'https://wa.me/5514996747344';
alter table public.store_settings alter column whatsapp_phone set default '5514996747344';
update public.store_settings
set whatsapp_url = 'https://wa.me/5514996747344', whatsapp_phone = '5514996747344'
where whatsapp_url = 'https://wa.me/message/AYTWXK3N666EC1';
alter table public.store_settings add column if not exists instagram_handle text not null default '@wplayeletronicosipaussu';
alter table public.store_settings add column if not exists city text not null default 'Ipaussu — SP';
alter table public.store_settings add column if not exists address_line text not null default 'R. Washington Luís, 887';
alter table public.store_settings add column if not exists postal_code text not null default '18950-025';
alter table public.store_settings add column if not exists maps_url text not null default 'https://maps.app.goo.gl/nrtpoXdpveMRe4mg9';
alter table public.store_settings add column if not exists hours_lines jsonb not null default '["Seg a Sex: consulte horário no WhatsApp", "Sábado: atendimento na loja e WhatsApp"]'::jsonb;
alter table public.store_settings add column if not exists custom_categories jsonb not null default '["Celulares", "Mobilidade", "Perfumes", "Áudio", "Acessórios"]'::jsonb;
alter table public.store_settings add column if not exists attendance_note text not null default 'Confirme preço, disponibilidade, formas de pagamento e entrega direto no WhatsApp.';

alter table public.products enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Public can read published products" on public.products;
create policy "Public can read published products" on public.products for select using (published);
drop policy if exists "Authenticated owner can manage products" on public.products;
create policy "Authenticated owner can manage products" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "Public can read store contacts" on public.store_settings;
create policy "Public can read store contacts" on public.store_settings for select using (true);
drop policy if exists "Authenticated owner can manage store contacts" on public.store_settings;
create policy "Authenticated owner can manage store contacts" on public.store_settings for all to authenticated using (true) with check (true);

insert into public.store_settings (id) values (true) on conflict (id) do nothing;
