create table if not exists public.products (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (char_length(category) between 1 and 48),
  description text not null default '' check (char_length(description) <= 240),
  badge text not null default '' check (char_length(badge) <= 48),
  price numeric(10,2) check (price is null or price >= 0),
  image text not null default '',
  image_fit text not null default 'cover' check (image_fit in ('cover', 'contain')),
  image_position text not null default '50% 50%',
  image_scale numeric not null default 1 check (image_scale between 0.1 and 5),
  published boolean not null default false,
  featured boolean not null default false,
  variants jsonb not null default '[]'::jsonb check (jsonb_typeof(variants) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'WPlay Eletrônicos',
  logo_url text not null default '/images/wplay-logo-official.png',
  hero_headline text not null default 'Toque, escolha e chame no WhatsApp.',
  whatsapp_url text not null default 'https://wa.me/5514996747344',
  whatsapp_phone text default '5514996747344',
  instagram_url text not null default 'https://www.instagram.com/wplayeletronicosipaussu/',
  instagram_handle text not null default '@wplayeletronicosipaussu',
  city text not null default 'Ipaussu — SP',
  address_line text not null default 'R. Washington Luís, 887',
  postal_code text not null default '18950-025',
  maps_url text not null default 'https://maps.app.goo.gl/nrtpoXdpveMRe4mg9',
  hours_lines jsonb not null default '[]'::jsonb check (jsonb_typeof(hours_lines) = 'array'),
  custom_categories jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_categories) = 'array'),
  custom_gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_gallery) = 'array'),
  hero_slides jsonb not null default '[]'::jsonb check (jsonb_typeof(hero_slides) = 'array'),
  attendance_note text not null default 'Confirme preço, disponibilidade, formas de pagamento e entrega direto no WhatsApp.',
  updated_at timestamptz not null default now()
);

create table if not exists public.store_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.store_admin_invites (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  invited_by uuid references auth.users(id) on delete set null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists store_admin_invites_invited_by_idx on public.store_admin_invites(invited_by);
create unique index if not exists store_owners_primary_idx on public.store_owners(is_primary) where is_primary;
create unique index if not exists store_admin_invites_primary_idx on public.store_admin_invites(is_primary) where is_primary;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_store_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.store_owners where user_id = (select auth.uid()));
$$;
create or replace function private.is_primary_store_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.store_owners where user_id = (select auth.uid()) and is_primary);
$$;
create or replace function private.claim_store_admin()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
begin
  if caller_id is null then return false; end if;
  select lower(email) into caller_email from auth.users
    where id = caller_id and email_confirmed_at is not null;
  if caller_email is null then return false; end if;
  perform 1 from public.store_admin_invites where email = caller_email for update;
  insert into public.store_owners (user_id, email, is_primary)
    select caller_id, caller_email, invite.is_primary
    from public.store_admin_invites as invite where invite.email = caller_email
    on conflict (user_id) do nothing;
  return exists (select 1 from public.store_owners where user_id = caller_id);
end;
$$;
create or replace function private.grant_store_admin(target_email text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
begin
  if not private.is_primary_store_owner() then
    raise exception 'Somente o administrador principal pode conceder acesso.' using errcode = '42501';
  end if;
  if normalized_email is null or length(normalized_email) > 254 or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  insert into public.store_admin_invites (email, invited_by)
    values (normalized_email, auth.uid()) on conflict (email) do nothing;
  insert into public.store_owners (user_id, email)
    select id, normalized_email from auth.users
    where lower(email) = normalized_email and email_confirmed_at is not null
    on conflict (user_id) do nothing;
  return true;
end;
$$;
create or replace function private.revoke_store_admin(target_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  target_email text;
begin
  if not private.is_primary_store_owner() then
    raise exception 'Somente o administrador principal pode remover acesso.' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() or exists (
    select 1 from public.store_owners where user_id = target_user_id and is_primary
  ) then
    raise exception 'O acesso do administrador principal não pode ser removido.' using errcode = '42501';
  end if;
  select email into target_email from public.store_owners where user_id = target_user_id;
  if target_email is null then return false; end if;
  return private.revoke_store_admin_email(target_email);
end;
$$;

create or replace function private.revoke_store_admin_email(target_email text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(target_email));
begin
  if not private.is_primary_store_owner() then
    raise exception 'Somente o administrador principal pode remover acesso.' using errcode = '42501';
  end if;
  perform 1 from public.store_admin_invites where email = normalized_email for update;
  if exists (select 1 from public.store_admin_invites where email = normalized_email and is_primary)
    or exists (select 1 from public.store_owners where email = normalized_email and (is_primary or user_id = auth.uid())) then
    raise exception 'O acesso do administrador principal não pode ser removido.' using errcode = '42501';
  end if;
  delete from public.store_owners where email = normalized_email and not is_primary;
  delete from public.store_admin_invites where email = normalized_email and not is_primary;
  return true;
end;
$$;

create or replace function public.claim_store_admin()
returns boolean language sql security invoker set search_path = ''
as $$ select private.claim_store_admin(); $$;
create or replace function public.grant_store_admin(target_email text)
returns boolean language sql security invoker set search_path = ''
as $$ select private.grant_store_admin(target_email); $$;
create or replace function public.revoke_store_admin(target_user_id uuid)
returns boolean language sql security invoker set search_path = ''
as $$ select private.revoke_store_admin(target_user_id); $$;
create or replace function public.revoke_store_admin_email(target_email text)
returns boolean language sql security invoker set search_path = ''
as $$ select private.revoke_store_admin_email(target_email); $$;

revoke all on function private.is_store_owner(), private.is_primary_store_owner(), private.claim_store_admin(), private.grant_store_admin(text), private.revoke_store_admin(uuid) from public, anon;
grant execute on function private.is_store_owner(), private.is_primary_store_owner(), private.claim_store_admin(), private.grant_store_admin(text), private.revoke_store_admin(uuid) to authenticated;
revoke all on function public.claim_store_admin(), public.grant_store_admin(text), public.revoke_store_admin(uuid) from public, anon;
grant execute on function public.claim_store_admin(), public.grant_store_admin(text), public.revoke_store_admin(uuid) to authenticated;
revoke all on function private.revoke_store_admin_email(text), public.revoke_store_admin_email(text) from public, anon;
grant execute on function private.revoke_store_admin_email(text), public.revoke_store_admin_email(text) to authenticated;

alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_owners enable row level security;
alter table public.store_admin_invites enable row level security;
revoke all on public.products, public.store_settings, public.store_owners, public.store_admin_invites from anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert, update, delete on public.products, public.store_settings to authenticated;
grant select on public.store_owners, public.store_admin_invites to authenticated;
grant delete on public.store_admin_invites to authenticated;

drop policy if exists "Public can read published products" on public.products;
create policy "Public can read published products" on public.products for select to anon, authenticated using (published);
drop policy if exists "Authenticated owner can manage products" on public.products;
create policy "Authenticated owner can manage products" on public.products for all to authenticated
  using ((select private.is_store_owner())) with check ((select private.is_store_owner()));
drop policy if exists "Public can read store contacts" on public.store_settings;
create policy "Public can read store contacts" on public.store_settings for select to anon, authenticated using (true);
drop policy if exists "Authenticated owner can manage store contacts" on public.store_settings;
create policy "Authenticated owner can manage store contacts" on public.store_settings for all to authenticated
  using ((select private.is_store_owner())) with check ((select private.is_store_owner()));
drop policy if exists "Owners can read permitted accounts" on public.store_owners;
create policy "Owners can read permitted accounts" on public.store_owners for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_primary_store_owner()));
drop policy if exists "Primary owner can read invitations" on public.store_admin_invites;
create policy "Primary owner can read invitations" on public.store_admin_invites for select to authenticated
  using ((select private.is_primary_store_owner()));
drop policy if exists "Primary owner can revoke invitations" on public.store_admin_invites;
create policy "Primary owner can revoke invitations" on public.store_admin_invites for delete to authenticated
  using (not is_primary and (select private.is_primary_store_owner()));

insert into public.store_settings (id) values (true) on conflict (id) do nothing;
