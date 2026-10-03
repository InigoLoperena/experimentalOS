-- Ejecutar después de 003_profiles_and_company.sql.
-- Crea adjuntos privados sin modificar los campos de las fichas.
begin;
create table if not exists public.record_attachments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 record_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 250),
 kind text not null check(kind in ('image','pdf','docx','link')),
 storage_path text unique,
 url text,
 mime_type text,
 size bigint,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(record_id,workspace_id) references public.records(id,workspace_id) on delete cascade,
 check((kind='link' and storage_path is null and url ~ '^https?://[^[:space:]]+$' and length(url)<=2000 and size is null and mime_type is null)
  or (kind<>'link' and url is null and storage_path is not null and size between 1 and 10485760 and
   ((kind='image' and mime_type in ('image/jpeg','image/png','image/webp','image/gif')) or
    (kind='pdf' and mime_type='application/pdf') or
    (kind='docx' and mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')))),
 check(kind='link' or storage_path like workspace_id::text||'/'||record_id::text||'/'||id::text||'.%')
);
create index if not exists attachments_record on public.record_attachments(record_id,created_at);
alter table public.record_attachments enable row level security;
drop policy if exists attachments_read on public.record_attachments;
create policy attachments_read on public.record_attachments for select to authenticated using(public.is_member(workspace_id));
drop policy if exists attachments_insert on public.record_attachments;
create policy attachments_insert on public.record_attachments for insert to authenticated with check(public.member_role(workspace_id) in ('owner','editor'));
drop policy if exists attachments_delete on public.record_attachments;
create policy attachments_delete on public.record_attachments for delete to authenticated using(public.member_role(workspace_id) in ('owner','editor'));
revoke all on public.record_attachments from anon,authenticated;
grant select,insert,delete on public.record_attachments to authenticated;

-- Colas de limpieza para borrar archivos tras eliminar una ficha o empresa.
-- Solo un trigger puede crear entradas. El autor de la eliminación conserva
-- acceso temporal al objeto para que la API de Storage pueda limpiarlo.
create table if not exists public.attachment_deletions (
 id uuid primary key default gen_random_uuid(),
 storage_path text not null unique,
 deleted_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.attachment_deletions enable row level security;
drop policy if exists attachment_cleanup_read on public.attachment_deletions;
create policy attachment_cleanup_read on public.attachment_deletions for select to authenticated using(deleted_by=auth.uid());
drop policy if exists attachment_cleanup_delete on public.attachment_deletions;
create policy attachment_cleanup_delete on public.attachment_deletions for delete to authenticated using(deleted_by=auth.uid());
revoke all on public.attachment_deletions from anon,authenticated;
grant select,delete on public.attachment_deletions to authenticated;

create or replace function public.stamp_attachment() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.records where id=new.record_id and workspace_id=new.workspace_id and kind in ('experiment','learning','north_star','goal','opportunity','idea')) then raise exception 'Este tipo de ficha no admite adjuntos';end if;
 -- Los CHECK deben rechazar NULL, no aceptarlo como un resultado desconocido.
 if new.kind='link' then
  if new.url is null or new.url !~ '^https?://[^[:space:]]+$' then raise exception 'Introduce un enlace http:// o https:// válido';end if;
 else
  if new.storage_path is null or new.mime_type is null or new.size is null then raise exception 'Faltan datos del archivo';end if;
  if new.storage_path !~ ('^'||new.workspace_id::text||'/'||new.record_id::text||'/'||new.id::text||'\.(png|jpg|jpeg|webp|gif|pdf|docx)$') then raise exception 'Ruta de adjunto inválida';end if;
 end if;
 new.created_by:=auth.uid();new.created_at:=now();return new;
end $$;
drop trigger if exists attachment_identity on public.record_attachments;
create trigger attachment_identity before insert on public.record_attachments for each row execute function public.stamp_attachment();

create or replace function public.audit_attachment() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 if tg_op='DELETE' and old.storage_path is not null then
  insert into public.attachment_deletions(storage_path,deleted_by) values(old.storage_path,auth.uid()) on conflict(storage_path) do nothing;
 end if;
 if tg_op='INSERT' then
  insert into public.audit_log(workspace_id,actor_id,action,record_id,title) values(new.workspace_id,auth.uid(),'attach',new.record_id,'Adjunto añadido: '||new.name);
  return new;
 else
  if exists(select 1 from public.workspaces where id=old.workspace_id) then
   insert into public.audit_log(workspace_id,actor_id,action,record_id,title) values(old.workspace_id,auth.uid(),'detach',old.record_id,'Adjunto retirado: '||old.name);
  end if;
  return old;
 end if;
end $$;
drop trigger if exists attachment_audit on public.record_attachments;
create trigger attachment_audit after insert or delete on public.record_attachments for each row execute function public.audit_attachment();

-- El acceso al archivo requiere una ficha de la misma empresa.
create or replace function public.can_read_attachment(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.record_attachments a where a.storage_path=path and public.is_member(a.workspace_id))
 or exists(select 1 from public.attachment_deletions d where d.storage_path=path and d.deleted_by=auth.uid());
$$;
create or replace function public.can_write_attachment(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.record_attachments a where a.storage_path=path and public.member_role(a.workspace_id) in ('owner','editor'));
$$;
create or replace function public.can_delete_attachment(path text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.can_write_attachment(path) or exists(select 1 from public.attachment_deletions d where d.storage_path=path and d.deleted_by=auth.uid());
$$;
revoke all on function public.stamp_attachment(),public.audit_attachment(),public.can_read_attachment(text),public.can_write_attachment(text),public.can_delete_attachment(text) from public,anon;
grant execute on function public.can_read_attachment(text),public.can_write_attachment(text),public.can_delete_attachment(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('record-attachments','record-attachments',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists os_attachments_read on storage.objects;
create policy os_attachments_read on storage.objects for select to authenticated using(bucket_id='record-attachments' and public.can_read_attachment(name));
drop policy if exists os_attachments_upload on storage.objects;
create policy os_attachments_upload on storage.objects for insert to authenticated with check(bucket_id='record-attachments' and public.can_write_attachment(name));
drop policy if exists os_attachments_remove on storage.objects;
create policy os_attachments_remove on storage.objects for delete to authenticated using(bucket_id='record-attachments' and public.can_delete_attachment(name));
notify pgrst, 'reload schema';
commit;
