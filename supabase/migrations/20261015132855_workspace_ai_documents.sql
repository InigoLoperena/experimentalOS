begin;
create table public.ai_documents (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid,knowledge_id uuid references public.ai_knowledge(id) on delete set null,
 name text not null check(length(name) between 1 and 250),mime_type text not null,size bigint not null check(size between 1 and 10485760),
 storage_path text not null unique,extraction_status text not null default 'pending' check(extraction_status in ('pending','ready','needs_review','failed')),
 extraction_note text not null default '',created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade,
 check(storage_path=workspace_id::text||'/'||id::text||'/original')
);
alter table public.ai_documents enable row level security;
revoke all on public.ai_documents from public,anon,authenticated;
grant select,insert,update on public.ai_documents to authenticated;
create policy ai_document_read on public.ai_documents for select to authenticated using(public.is_member(workspace_id));
create policy ai_document_add on public.ai_documents for insert to authenticated with check(created_by=(select auth.uid()) and public.can_record_action(workspace_id,'learning','create'));
create policy ai_document_edit on public.ai_documents for update to authenticated using(public.can_record_action(workspace_id,'learning','edit')) with check(public.can_record_action(workspace_id,'learning','edit'));
-- Creators may finish indexing their upload even if they can create but cannot edit team knowledge.
create policy ai_document_finish on public.ai_documents for update to authenticated using(created_by=(select auth.uid()) and public.can_record_action(workspace_id,'learning','create') and knowledge_id is null) with check(created_by=(select auth.uid()) and public.can_record_action(workspace_id,'learning','create'));
create function experimental_private.check_ai_document() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.project_id is not null and not exists(select 1 from public.records where id=new.project_id and workspace_id=new.workspace_id and kind='project') then raise exception 'Proyecto no autorizado';end if;
 if new.knowledge_id is not null and not exists(select 1 from public.ai_knowledge where id=new.knowledge_id and workspace_id=new.workspace_id and project_id is not distinct from new.project_id) then raise exception 'Fuente no autorizada';end if;
 if tg_op='UPDATE' and (new.id,new.workspace_id,new.project_id,new.storage_path,new.name,new.mime_type,new.size,new.created_by,new.created_at) is distinct from (old.id,old.workspace_id,old.project_id,old.storage_path,old.name,old.mime_type,old.size,old.created_by,old.created_at) then raise exception 'La identidad del documento no puede cambiar';end if;
 return new;
end $$;
revoke all on function experimental_private.check_ai_document() from public,anon,authenticated;
create trigger ai_document_identity before insert or update on public.ai_documents for each row execute function experimental_private.check_ai_document();
create index ai_document_scope on public.ai_documents(workspace_id,created_at);
create index ai_document_author on public.ai_documents(created_by);
create index ai_document_knowledge on public.ai_documents(knowledge_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ai-documents','ai-documents',false,10485760,array['text/plain','text/csv','application/json','text/markdown','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']);
create policy ai_original_read on storage.objects for select to authenticated using(bucket_id='ai-documents' and exists(select 1 from public.ai_documents d where d.storage_path=storage.objects.name and public.is_member(d.workspace_id)));
create policy ai_original_add on storage.objects for insert to authenticated with check(bucket_id='ai-documents' and exists(select 1 from public.ai_documents d where d.storage_path=storage.objects.name and d.created_by=(select auth.uid()) and public.can_record_action(d.workspace_id,'learning','create')));
notify pgrst,'reload schema';commit;
