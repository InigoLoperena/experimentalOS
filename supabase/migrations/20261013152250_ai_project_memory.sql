begin;
create table public.ai_knowledge (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 200),
 content text not null check(length(trim(content)) between 1 and 100000),
 format text not null check(format in ('text','csv','json')),
 source text not null default '' check(length(source)<=2000),
 validation text not null default 'unverified' check(validation in ('unverified','reviewed')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade
);
create table public.ai_chat_entries (
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid not null,
 user_id uuid not null default auth.uid() references auth.users(id),
 question text not null check(length(trim(question)) between 1 and 6000),
 answer text not null check(length(trim(answer)) between 1 and 16000),
 proposal jsonb,
 sources jsonb not null default '[]' check(jsonb_typeof(sources)='array'),
 coverage jsonb not null default '{}',
 created_at timestamptz not null default now(),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade
);
-- A composite FK prevents crossing workspaces; this trigger also rejects non-project records.
create function experimental_private.check_ai_project() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.records where id=new.project_id and workspace_id=new.workspace_id and kind='project') then raise exception 'Selecciona un proyecto autorizado';end if;
 return new;
end $$;
revoke all on function experimental_private.check_ai_project() from public,anon,authenticated;
create trigger ai_knowledge_project before insert or update on public.ai_knowledge for each row execute function experimental_private.check_ai_project();
create trigger ai_chat_project before insert or update on public.ai_chat_entries for each row execute function experimental_private.check_ai_project();
alter table public.ai_knowledge enable row level security;
alter table public.ai_chat_entries enable row level security;
revoke all on public.ai_knowledge,public.ai_chat_entries from public,anon,authenticated;
grant select,insert,delete on public.ai_knowledge,public.ai_chat_entries to authenticated;
create policy ai_knowledge_read on public.ai_knowledge for select to authenticated using(public.is_member(workspace_id));
create policy ai_knowledge_add on public.ai_knowledge for insert to authenticated with check(created_by=(select auth.uid()) and public.can_record_action(workspace_id,'learning','create'));
create policy ai_knowledge_delete on public.ai_knowledge for delete to authenticated using(public.can_record_action(workspace_id,'learning','delete'));
create policy ai_chat_read on public.ai_chat_entries for select to authenticated using(user_id=(select auth.uid()) and public.is_member(workspace_id));
create policy ai_chat_add on public.ai_chat_entries for insert to authenticated with check(user_id=(select auth.uid()) and public.is_member(workspace_id));
create policy ai_chat_delete on public.ai_chat_entries for delete to authenticated using(user_id=(select auth.uid()) and public.is_member(workspace_id));
create index ai_knowledge_scope on public.ai_knowledge(workspace_id,project_id,created_at,id);
create index ai_knowledge_author on public.ai_knowledge(created_by);
create index ai_chat_scope on public.ai_chat_entries(workspace_id,project_id,user_id,created_at,id);
create index ai_chat_user on public.ai_chat_entries(user_id);
-- Chat readers may ask questions; record creation still uses existing granular permissions.
-- Reuse the existing workspace budget, request IDs and lock across both AI entry points.
create function experimental_private.reserve_ai_chat(p_workspace uuid,p_request uuid) returns numeric language plpgsql security definer set search_path='' as $$
declare spent numeric;
begin
 if auth.uid() is null or not public.is_member(p_workspace) then raise exception 'No tienes acceso a la IA del equipo';end if;
 perform pg_advisory_xact_lock(hashtextextended('ai:'||p_workspace::text,0));
 if exists(select 1 from public.ai_preparation_usage where request_id=p_request) then raise exception 'Esta solicitud ya fue procesada';end if;
 if exists(select 1 from public.ai_preparation_usage where workspace_id=p_workspace and created_at>now()-interval '15 seconds') then raise exception 'Espera 15 segundos antes de otra consulta';end if;
 select coalesce(sum(reserved_usd),0) into spent from public.ai_preparation_usage where workspace_id=p_workspace and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if spent+0.03>5 then raise exception 'Se ha alcanzado el límite mensual de IA de 5 USD';end if;
 insert into public.ai_preparation_usage(request_id,workspace_id,user_id) values(p_request,p_workspace,auth.uid());
 return spent+0.03;
end $$;
create function public.reserve_ai_chat(p_workspace uuid,p_request uuid) returns numeric language sql security invoker set search_path='' as $$ select experimental_private.reserve_ai_chat(p_workspace,p_request) $$;
revoke all on function experimental_private.reserve_ai_chat(uuid,uuid),public.reserve_ai_chat(uuid,uuid) from public,anon,authenticated;
grant execute on function experimental_private.reserve_ai_chat(uuid,uuid),public.reserve_ai_chat(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
