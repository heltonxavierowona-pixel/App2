-- Stockage privé des pièces : documents/<organization_id>/<shipment_id>/<type>-<horodatage>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'identifiant de l'entreprise.
create function private.can_access_document(object_name text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.organization_id::text = split_part(object_name, '/', 1)
  );
$$;

revoke all on function private.can_access_document(text) from public;
grant execute on function private.can_access_document(text) to authenticated;

create policy documents_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and private.can_access_document(name));
create policy documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and private.can_access_document(name));
create policy documents_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and private.can_access_document(name))
  with check (bucket_id = 'documents' and private.can_access_document(name));
create policy documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and private.can_access_document(name));
