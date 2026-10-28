-- Repairs permissions without granting administrative access to ordinary users.
-- Requires the private authorization helpers from supabase/schema.sql.
-- Review and apply through the database's normal migration process.
begin;

do $$
begin
  if to_regprocedure('private.is_store_owner()') is null
     or to_regprocedure('private.is_primary_store_owner()') is null then
    raise exception 'Apply the reviewed authorization schema before this repair.';
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
revoke all on public.store_owners, public.store_admin_invites from anon, authenticated;
grant select on public.store_owners, public.store_admin_invites to authenticated;
grant delete on public.store_admin_invites to authenticated;

alter table public.store_owners enable row level security;
alter table public.store_admin_invites enable row level security;
drop policy if exists "Owners can update accounts" on public.store_owners;
drop policy if exists "Primary owner can manage invitations" on public.store_admin_invites;

drop policy if exists "Owners can read permitted accounts" on public.store_owners;
create policy "Owners can read permitted accounts" on public.store_owners for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_primary_store_owner()));

drop policy if exists "Primary owner can read invitations" on public.store_admin_invites;
create policy "Primary owner can read invitations" on public.store_admin_invites for select to authenticated
  using ((select private.is_primary_store_owner()));

drop policy if exists "Primary owner can revoke invitations" on public.store_admin_invites;
create policy "Primary owner can revoke invitations" on public.store_admin_invites for delete to authenticated
  using (not is_primary and (select private.is_primary_store_owner()));

-- Compatibility for an older caller; this wrapper cannot promote any account.
create or replace function public.is_store_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select auth.uid() is not null and private.is_store_owner(); $$;
revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

alter table public.store_settings add column if not exists custom_phone_models jsonb not null default '[]'::jsonb;
commit;
