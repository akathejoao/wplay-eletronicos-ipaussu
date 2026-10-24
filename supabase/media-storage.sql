insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media', 'catalog-media', true, 256000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 256000, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Store owners can upload catalog media" on storage.objects;
create policy "Store owners can upload catalog media" on storage.objects for insert to authenticated
with check (bucket_id = 'catalog-media' and (select private.is_store_owner()));

drop policy if exists "Store owners can inspect catalog media" on storage.objects;
create policy "Store owners can inspect catalog media" on storage.objects for select to authenticated
using (bucket_id = 'catalog-media' and (select private.is_store_owner()));

drop policy if exists "Store owners can remove catalog media" on storage.objects;
create policy "Store owners can remove catalog media" on storage.objects for delete to authenticated
using (bucket_id = 'catalog-media' and (select private.is_store_owner()));
