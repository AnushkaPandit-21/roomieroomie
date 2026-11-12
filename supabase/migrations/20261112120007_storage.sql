-- Photo storage (D15): private bucket. Object paths are "<owner_profile_id>/<file>".
-- Upload/replace/delete: only inside your own folder.
-- Read (signed URLs / authenticated download): only photos of profiles you are allowed to see (D16).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder name -> owner id, or null if the folder is not a uuid (such objects are unreadable).
create or replace function private.photo_owner(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

revoke all on function private.photo_owner(text) from public, anon;
grant execute on function private.photo_owner(text) to authenticated, service_role;

drop policy if exists photos_bucket_read on storage.objects;
create policy photos_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and private.can_view_profile((select auth.uid()), private.photo_owner(name))
  );

drop policy if exists photos_bucket_insert_own on storage.objects;
create policy photos_bucket_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and private.photo_owner(name) = (select auth.uid())
  );

drop policy if exists photos_bucket_update_own on storage.objects;
create policy photos_bucket_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()))
  with check (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()));

drop policy if exists photos_bucket_delete_own on storage.objects;
create policy photos_bucket_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and private.photo_owner(name) = (select auth.uid()));
