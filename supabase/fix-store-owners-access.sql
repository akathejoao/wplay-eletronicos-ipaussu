-- ============================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA DE PERMISSÕES: STORE_OWNERS & STORE_ADMIN_INVITES
-- Execute este script no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Garantir permissões de schema e tabelas para o papel autenticado (authenticated)
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.store_owners to authenticated;
grant select, insert, update, delete on table public.store_admin_invites to authenticated;

-- Permitir leitura anônima apenas se necessário, mas o painel admin roda autenticado
grant select on table public.store_owners to anon, authenticated;

-- 2. Criar função SECURITY DEFINER para verificar se o usuário atual é administrador
-- Isso ignora qualquer problema de permissão direta de leitura na tabela store_owners
create or replace function public.is_store_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
begin
  if caller_id is null then
    return false;
  end if;

  -- 1. Verifica se já está registrado como store_owner
  if exists (select 1 from public.store_owners where user_id = caller_id) then
    return true;
  end if;

  -- 2. Busca e-mail do usuário no auth.users
  select lower(email) into caller_email
  from auth.users
  where id = caller_id;

  if caller_email is not null then
    -- Se o e-mail estiver na lista de convites de admin
    if exists (select 1 from public.store_admin_invites where lower(email) = caller_email) then
      -- Auto-cadastra na tabela store_owners
      insert into public.store_owners (user_id, email, is_primary)
      select caller_id, caller_email, coalesce(invite.is_primary, false)
      from public.store_admin_invites as invite
      where lower(invite.email) = caller_email
      on conflict (user_id) do update
        set email = excluded.email,
            is_primary = excluded.is_primary or store_owners.is_primary;
      return true;
    end if;

    -- Se for o e-mail do proprietário oficial (joaopro9678@gmail.com)
    if caller_email = 'joaopro9678@gmail.com' then
      insert into public.store_owners (user_id, email, is_primary)
      values (caller_id, caller_email, true)
      on conflict (user_id) do update set is_primary = true;
      return true;
    end if;
  end if;

  return false;
end;
$$;

grant execute on function public.is_store_admin() to authenticated, anon;

-- 3. Registrar o e-mail joaopro9678@gmail.com como administrador principal
insert into public.store_admin_invites (email, is_primary)
values ('joaopro9678@gmail.com', true)
on conflict (email) do update set is_primary = true;

-- 4. Se o usuário já tiver criado a conta no Supabase Auth, adiciona na store_owners imediatamente
insert into public.store_owners (user_id, email, is_primary)
select id, lower(email), true
from auth.users
where lower(email) = 'joaopro9678@gmail.com'
on conflict (user_id) do update set is_primary = true, email = excluded.email;

-- 5. Configurar Row Level Security (RLS) sem recursão
alter table public.store_owners enable row level security;
alter table public.store_admin_invites enable row level security;

drop policy if exists "Owners can read permitted accounts" on public.store_owners;
create policy "Owners can read permitted accounts" on public.store_owners
  for select to authenticated
  using (user_id = auth.uid() or public.is_store_admin());

drop policy if exists "Owners can update accounts" on public.store_owners;
create policy "Owners can update accounts" on public.store_owners
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

drop policy if exists "Primary owner can read invitations" on public.store_admin_invites;
create policy "Primary owner can read invitations" on public.store_admin_invites
  for select to authenticated
  using (public.is_store_admin());

drop policy if exists "Primary owner can manage invitations" on public.store_admin_invites;
create policy "Primary owner can manage invitations" on public.store_admin_invites
  for all to authenticated
  using (public.is_store_admin())
  with check (public.is_store_admin());

-- 6. Adicionar coluna custom_phone_models na store_settings se não existir
alter table public.store_settings
  add column if not exists custom_phone_models jsonb not null default '[]'::jsonb;
