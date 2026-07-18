-- Run after the migrations. The bucket is private and direct anon/authenticated access is denied.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-files','project-files',false,26214400,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv','text/markdown','application/json','application/zip','image/png','image/jpeg'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "deny project files to anon" on storage.objects;
create policy "deny project files to anon" on storage.objects for all to anon using(false) with check(false);
drop policy if exists "deny project files to authenticated" on storage.objects;
create policy "deny project files to authenticated" on storage.objects for all to authenticated using(false) with check(false);

