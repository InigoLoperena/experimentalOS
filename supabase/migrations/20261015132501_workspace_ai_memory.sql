begin;
-- Preserve historical project attribution while allowing knowledge/conversations for the whole team.
alter table public.ai_knowledge alter column project_id drop not null;
alter table public.ai_chat_entries alter column project_id drop not null;
alter table public.ai_knowledge add column category text not null default 'note' check(category in ('note','team_style','learning','research'));
alter table public.ai_knowledge add column evidence text not null default '' check(length(evidence)<=10000);
alter table public.ai_knowledge add column updated_at timestamptz not null default now();
alter table public.ai_knowledge add column archived_at timestamptz;
alter table public.ai_knowledge add column reviewed_by uuid references auth.users(id);
alter table public.ai_knowledge add column reviewed_at timestamptz;
create table public.ai_knowledge_revisions(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,knowledge_id uuid not null,previous jsonb not null,changed_by uuid references auth.users(id),changed_at timestamptz not null default clock_timestamp());
alter table public.ai_knowledge_revisions enable row level security;
revoke all on public.ai_knowledge_revisions from public,anon,authenticated;
grant select on public.ai_knowledge_revisions to authenticated;
create policy ai_revision_read on public.ai_knowledge_revisions for select to authenticated using(public.is_member(workspace_id));
create index ai_revision_scope on public.ai_knowledge_revisions(workspace_id,knowledge_id,changed_at);
create index ai_revision_author on public.ai_knowledge_revisions(changed_by);
alter table public.ai_knowledge drop constraint ai_knowledge_validation_check;
alter table public.ai_knowledge add constraint ai_knowledge_validation_check check(validation in ('unverified','reviewed','contradicted'));
create or replace function experimental_private.check_ai_project() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.project_id is not null and not exists(select 1 from public.records where id=new.project_id and workspace_id=new.workspace_id and kind='project') then raise exception 'Selecciona un proyecto autorizado';end if;
 if tg_op='UPDATE' then
  if (new.id,new.workspace_id,new.project_id,new.created_by,new.created_at) is distinct from (old.id,old.workspace_id,old.project_id,old.created_by,old.created_at) then raise exception 'La identidad de la fuente no puede cambiar';end if;
  new.updated_at:=clock_timestamp();
 end if;
 return new;
end $$;
grant update on public.ai_knowledge to authenticated;
create policy ai_knowledge_edit on public.ai_knowledge for update to authenticated using(public.can_record_action(workspace_id,'learning','edit')) with check(public.can_record_action(workspace_id,'learning','edit'));
create function experimental_private.audit_ai_knowledge() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='UPDATE' then insert into public.ai_knowledge_revisions(workspace_id,knowledge_id,previous,changed_by) values(old.workspace_id,old.id,to_jsonb(old),auth.uid());end if;
 if tg_op='INSERT' or new.validation is distinct from old.validation then
  new.reviewed_by:=case when new.validation in ('reviewed','contradicted') then auth.uid() else null end;
  new.reviewed_at:=case when new.validation in ('reviewed','contradicted') then clock_timestamp() else null end;
 else new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;end if;
 return new;
end $$;
revoke all on function experimental_private.audit_ai_knowledge() from public,anon,authenticated;
create trigger ai_knowledge_review before insert or update on public.ai_knowledge for each row execute function experimental_private.audit_ai_knowledge();

-- An indexed, rebuildable catalog; the source tables and private originals remain authoritative.
create table public.ai_memory_chunks (
 source_table text not null, source_id uuid not null, part integer not null,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid, record_id uuid, title text not null, kind text not null,
 validation text not null, category text not null, date timestamptz not null, excerpt text not null,
 search_vector tsvector generated always as (to_tsvector('spanish',title||' '||excerpt)||to_tsvector('english',title||' '||excerpt)) stored,
 primary key(source_table,source_id,part),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade
);
alter table public.ai_memory_chunks enable row level security;
revoke all on public.ai_memory_chunks from public,anon,authenticated;
grant select on public.ai_memory_chunks to authenticated;
create policy ai_memory_read on public.ai_memory_chunks for select to authenticated using(public.is_member(workspace_id));
create index ai_memory_scope on public.ai_memory_chunks(workspace_id,project_id,date);
create index ai_memory_search on public.ai_memory_chunks using gin(search_vector);
create function experimental_private.index_ai_source(t text,r jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare content text; title text; kind text; project uuid; record uuid; validation text:='unverified'; category text:='note'; stamp timestamptz;begin
 delete from public.ai_memory_chunks where source_table=t and source_id=(r->>'id')::uuid;
 project:=(r->>'project_id')::uuid;stamp:=coalesce((r->>'updated_at')::timestamptz,(r->>'created_at')::timestamptz);
 if t='records' then
  kind:=r->>'kind';title:=r->>'title';if kind='project' then project:=(r->>'id')::uuid;end if;
  select jsonb_build_object('parent_id',r->'parent_id','related_id',r->'related_id','fields',coalesce(jsonb_object_agg(k,r->'fields'->k),'{}'::jsonb))::text into content
   from unnest(array['description','north_star','definition','metric','baseline','current','target','unit','period','source','context','hypothesis','success_criteria','result','conclusion','evidence','learning','decision','next_steps','start','end','tags','channel','focus','experimental_focus','opportunity_type','validation']) k where r->'fields' ? k;
  record:=(r->>'id')::uuid;
 elsif t='ai_knowledge' then
  if r->>'archived_at' is not null then return;end if;
  title:=r->>'title';validation:=r->>'validation';category:=r->>'category';kind:='import_'||(r->>'format');
  content:='Procedencia: '||coalesce(r->>'source','')||E'\nEvidencia: '||coalesce(r->>'evidence','')||E'\n'||(r->>'content');
 else
  record:=(r->>'experiment_id')::uuid;
  select x.title into title from public.records x where x.id=record and x.workspace_id=(r->>'workspace_id')::uuid;
  kind:=case t when 'metric_observations' then 'measurement' when 'provider_result_snapshots' then 'provider_result' when 'experiment_variants' then 'variant' else 'external_resource' end;
  title:=kind||' · '||coalesce(title,'');content:=r::text;validation:=case when t in ('metric_observations','provider_result_snapshots') then 'observed' else 'unverified' end;
 end if;
 insert into public.ai_memory_chunks(source_table,source_id,part,workspace_id,project_id,record_id,title,kind,validation,category,date,excerpt)
 select t,(r->>'id')::uuid,i,(r->>'workspace_id')::uuid,project,record,title,kind,validation,category,stamp,substring(content from i*2000+1 for 2200)
 from generate_series(0,greatest(0,(length(content)-1)/2000)) i;
end $$;
revoke all on function experimental_private.index_ai_source(text,jsonb) from public,anon,authenticated;
create function experimental_private.refresh_ai_memory() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then delete from public.ai_memory_chunks where source_table=tg_table_name and source_id=old.id;return old;end if;
 perform experimental_private.index_ai_source(tg_table_name,to_jsonb(new));return new;
end $$;
revoke all on function experimental_private.refresh_ai_memory() from public,anon,authenticated;
do $$declare t text;r jsonb;begin
 foreach t in array array['records','ai_knowledge','metric_observations','experiment_variants','external_resources'] loop
  execute format('create trigger ai_memory_index after insert or update or delete on public.%I for each row execute function experimental_private.refresh_ai_memory()',t);
  for r in execute format('select to_jsonb(s) from public.%I s',t) loop perform experimental_private.index_ai_source(t,r);end loop;
 end loop;
end $$;
create function public.search_workspace_memory(w uuid,q text,p uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$
 with ranked as (
 select c.*,ts_rank(c.search_vector,websearch_to_tsquery('spanish',left(q,2000))||websearch_to_tsquery('english',left(q,2000))) as rank,
  (category='team_style' and validation='reviewed') as style
 from public.ai_memory_chunks c where c.workspace_id=w and (p is null or c.project_id=p or c.project_id is null)
 ), picked as (select * from ranked order by style desc,rank desc,date desc,source_id,part limit 60)
 select jsonb_build_object('sources',coalesce((select jsonb_agg(jsonb_build_object('id',source_id,'title',title||case when part>0 then ' · parte '||(part+1)::text else '' end,'kind',kind,'project_id',project_id,'record_id',record_id,'date',date,'excerpt',excerpt,'validation',validation,'category',category) order by style desc,rank desc,date desc,source_id,part) from picked),'[]'::jsonb),
 'coverage',jsonb_build_object('available',(select count(*) from ranked),'included',(select count(*) from picked)))
$$;
revoke all on function public.search_workspace_memory(uuid,text,uuid) from public,anon;
grant execute on function public.search_workspace_memory(uuid,text,uuid) to authenticated;
create function public.workspace_metric_facts(w uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with groups as (
 select o.project_id,o.experiment_id,o.resource_id,o.period_start,o.period_end,max(o.updated_at) as observed_at,
 jsonb_object_agg(o.metric,jsonb_build_object('value',o.value,'unit',o.unit,'currency',o.currency,'source_id',o.id,'notes',o.notes)) as values,
 max(o.value) filter(where o.metric='clicks' and o.unit='count') as clicks,
 max(o.value) filter(where o.metric='impressions' and o.unit='count') as impressions,
 max(o.value) filter(where o.metric='spend' and o.unit='currency') as spend,
 max(o.currency) filter(where o.metric='spend' and o.unit='currency') as currency,
 max(o.value) filter(where o.metric='emails_sent' and o.unit='count') as sent,
 max(o.value) filter(where o.metric='email_replies' and o.unit='count') as replies
 from public.metric_observations o where o.workspace_id=w group by o.project_id,o.experiment_id,o.resource_id,o.period_start,o.period_end
 order by observed_at desc limit 100)
 select coalesce(jsonb_agg(jsonb_build_object('project_id',g.project_id,'experiment_id',g.experiment_id,'resource_id',g.resource_id,'provider',r.provider,'resource_type',r.resource_type,'period_start',g.period_start,'period_end',g.period_end,'observed_at',g.observed_at,'values',g.values,
 'calculated',jsonb_build_object('click_through_ratio',case when r.provider in ('meta_ads','google_ads') then g.clicks/nullif(g.impressions,0) end,'cost_per_click',case when r.provider in ('meta_ads','google_ads') then g.spend/nullif(g.clicks,0) end,'currency',g.currency,'reply_per_sent',case when r.provider='smartlead' then g.replies/nullif(g.sent,0) end),
 'meaning','Cálculos por recurso y periodo exactos, sin sumar campañas padre/hijas ni periodos solapados. No prueban causalidad.')),'[]'::jsonb)
 from groups g join public.external_resources r on r.id=g.resource_id and r.workspace_id=w
$$;
revoke all on function public.workspace_metric_facts(uuid) from public,anon;
grant execute on function public.workspace_metric_facts(uuid) to authenticated;
-- Close the real workspace preview; the signed-in team and its identifiers are preserved.
update experimental_private.public_preview set enabled=false where enabled;
notify pgrst,'reload schema';
commit;
