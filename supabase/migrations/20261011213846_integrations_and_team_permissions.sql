begin;
-- Preserve existing collaborator access; future restrictions are explicit owner decisions.
alter table public.members add column permissions text[] not null default array['projects.create','projects.edit','projects.delete','experiments.create','experiments.edit','experiments.delete','learnings.create','learnings.edit','learnings.delete','growth.create','growth.edit','growth.delete'];
alter table public.members add constraint member_permissions_valid check(permissions <@ array['projects.create','projects.edit','projects.delete','experiments.create','experiments.edit','experiments.delete','learnings.create','learnings.edit','learnings.delete','growth.create','growth.edit','growth.delete']::text[]);

create function public.can_record_action(w uuid,k text,a text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select m.role='owner' or (m.role='editor' and (case k when 'project' then 'projects' when 'experiment' then 'experiments' when 'learning' then 'learnings' else 'growth' end || '.' || a)=any(m.permissions))
 from public.members m where m.workspace_id=w and m.user_id=auth.uid()),false) and a in ('create','edit','delete') and k in ('project','experiment','learning','north_star','goal','opportunity','idea','objective','kr');
$$;
create function public.set_member_permissions(w uuid,member_id uuid,granted text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el superadministrador puede configurar permisos';end if;
 if granted is null then raise exception 'Permisos inválidos';end if;
 update public.members set permissions=granted where workspace_id=w and user_id=member_id and role<>'owner';
 if not found then raise exception 'Colaborador inexistente o superadministrador';end if;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'permissions','Permisos de colaborador actualizados');
end $$;
revoke all on function public.can_record_action(uuid,text,text),public.set_member_permissions(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.can_record_action(uuid,text,text),public.set_member_permissions(uuid,uuid,text[]) to authenticated;
alter policy records_insert on public.records with check(public.can_record_action(workspace_id,kind,'create'));
alter policy records_update on public.records using(public.can_record_action(workspace_id,kind,'edit')) with check(public.can_record_action(workspace_id,kind,'edit'));
alter policy records_delete on public.records using(public.can_record_action(workspace_id,kind,'delete'));

create function public.can_edit_record(w uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.records where id=r and workspace_id=w and public.can_record_action(w,kind,'edit'));
$$;
revoke all on function public.can_edit_record(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_edit_record(uuid,uuid) to authenticated;
alter policy attachments_insert on public.record_attachments with check(public.can_edit_record(workspace_id,record_id));
alter policy attachments_delete on public.record_attachments using(public.can_edit_record(workspace_id,record_id));
alter policy record_comments_insert on public.record_comments with check(public.can_edit_record(workspace_id,record_id) and author_id=(select auth.uid()));
create or replace function public.can_write_attachment(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.record_attachments a where a.storage_path=path and public.can_edit_record(a.workspace_id,a.record_id));
$$;
do $$ declare t text;begin
 foreach t in array array['experiment_specs','experiment_variants','external_resources','metric_observations'] loop
  execute format('alter policy %I on public.%I with check(public.can_record_action(workspace_id,''experiment'',''edit''))',t||'_insert',t);
  execute format('alter policy %I on public.%I using(public.can_record_action(workspace_id,''experiment'',''edit'')) with check(public.can_record_action(workspace_id,''experiment'',''edit''))',t||'_update',t);
  if t<>'experiment_specs' then execute format('alter policy %I on public.%I using(public.can_record_action(workspace_id,''experiment'',''edit''))',t||'_delete',t);end if;
 end loop;
end $$;
alter policy metric_observations_insert on public.metric_observations with check(public.can_record_action(workspace_id,'experiment','edit') and source in ('manual','csv'));
alter policy metric_observations_update on public.metric_observations using(public.can_record_action(workspace_id,'experiment','edit') and source in ('manual','csv')) with check(public.can_record_action(workspace_id,'experiment','edit') and source in ('manual','csv'));
alter policy metric_observations_delete on public.metric_observations using(public.can_record_action(workspace_id,'experiment','edit') and source in ('manual','csv'));

-- An atomic project deletion includes its tree, even if individual record delete permissions differ.
create function public.delete_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.records;begin
 select * into r from public.records where id=p_project and kind='project' for update;
 if r.id is null or not public.can_record_action(r.workspace_id,'project','delete') then raise exception 'No tienes permiso para eliminar este proyecto';end if;
 delete from public.records where workspace_id=r.workspace_id and project_id=r.id;
 delete from public.records where id=r.id and workspace_id=r.workspace_id;
end $$;
revoke all on function public.delete_project(uuid) from public,anon,authenticated;
grant execute on function public.delete_project(uuid) to authenticated;

create table public.integration_connections(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid,
 provider text not null check(provider in ('openai','meta_ads','posthog','google_ads','metricool','smartlead','linkedin_ads','tiktok_ads','app_store','google_play')),
 config jsonb not null default '{}' check(jsonb_typeof(config)='object' and octet_length(config::text)<10000),
 source text not null check(source in ('server','encrypted')),
 secret_fields text[] not null default '{}',
 enabled boolean not null default true,
 verified_at timestamptz,
 verification_note text not null default '' check(length(verification_note)<=500),
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid references auth.users(id),
 unique nulls not distinct(workspace_id,provider,project_id),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade,
 check((provider='openai' and project_id is null) or (provider<>'openai' and project_id is not null))
);
alter table public.integration_connections enable row level security;
revoke all on public.integration_connections from public,anon,authenticated;
grant select on public.integration_connections to authenticated;
create policy integration_read on public.integration_connections for select to authenticated using(public.is_member(workspace_id));
create index integration_project on public.integration_connections(project_id) where project_id is not null;
create table experimental_private.integration_secrets(
 connection_id uuid primary key references public.integration_connections(id) on delete cascade,
 envelope text not null check(length(envelope) between 40 and 65000)
);
alter table experimental_private.integration_secrets enable row level security;
revoke all on experimental_private.integration_secrets from public,anon,authenticated;
-- Only authenticated ciphertext leaves this private schema. Plaintext is never stored in SQL.
create function public.read_integration_envelope(p_id uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare w uuid;begin
 select workspace_id into w from public.integration_connections where id=p_id;
 if w is null or not public.is_member(w) then raise exception 'Conexión no autorizada';end if;
 return (select envelope from experimental_private.integration_secrets where connection_id=p_id);
end $$;
create function public.save_integration(p_workspace uuid,p_project uuid,p_provider text,p_config jsonb,p_fields text[],p_envelope text,p_expected timestamptz default null) returns public.integration_connections
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections;begin
 if public.member_role(p_workspace) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 if p_project is not null and not exists(select 1 from public.records where id=p_project and workspace_id=p_workspace and kind='project') then raise exception 'Proyecto no autorizado';end if;
 perform pg_advisory_xact_lock(hashtextextended('integration:'||p_workspace::text||p_provider||coalesce(p_project::text,''),0));
 select * into r from public.integration_connections where workspace_id=p_workspace and provider=p_provider and project_id is not distinct from p_project for update;
 if (r.id is not null and r.updated_at is distinct from p_expected) or (r.id is null and p_expected is not null) then raise exception 'La configuración ha cambiado. Actualiza antes de guardar';end if;
 insert into public.integration_connections(workspace_id,project_id,provider,config,source,secret_fields,updated_by)
 values(p_workspace,p_project,p_provider,p_config,'encrypted',p_fields,auth.uid())
 on conflict(workspace_id,provider,project_id) do update set config=excluded.config,source='encrypted',secret_fields=excluded.secret_fields,enabled=true,verified_at=null,verification_note='',updated_at=clock_timestamp(),updated_by=auth.uid() returning * into r;
 insert into experimental_private.integration_secrets(connection_id,envelope) values(r.id,p_envelope) on conflict(connection_id) do update set envelope=excluded.envelope;
 if p_provider='posthog' then
  update public.records set fields=fields||jsonb_build_object('posthog_project_id',p_config->>'project_id','posthog_host',p_config->>'host') where id=p_project and workspace_id=p_workspace and kind='project';
 end if;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(p_workspace,auth.uid(),'integration','Configuración de integración actualizada: '||p_provider);
 return r;
end $$;
create function public.set_integration_state(p_id uuid,p_expected timestamptz,p_enabled boolean,p_note text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections;begin
 select * into r from public.integration_connections where id=p_id for update;
 if r.id is null or public.member_role(r.workspace_id) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 if r.updated_at is distinct from p_expected then raise exception 'La configuración ha cambiado. Actualiza antes de continuar';end if;
 update public.integration_connections set enabled=p_enabled,verified_at=case when p_note is not null then clock_timestamp() else null end,verification_note=coalesce(p_note,''),updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(r.workspace_id,auth.uid(),'integration',case when p_enabled then 'Integración revisada: ' else 'Integración desactivada: ' end||r.provider);
end $$;
revoke all on function public.read_integration_envelope(uuid),public.save_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),public.set_integration_state(uuid,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function public.read_integration_envelope(uuid),public.save_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),public.set_integration_state(uuid,timestamptz,boolean,text) to authenticated;

-- Trusted historical bindings, without copying any server secret into SQL.
insert into public.integration_connections(workspace_id,project_id,provider,config,source)
select workspace_id,project_id,'posthog',jsonb_build_object('project_id',external_project_id,'host',host),'server' from public.posthog_project_bindings;
insert into public.integration_connections(workspace_id,provider,source)
select workspace_id,'openai','server' from experimental_private.public_preview where singleton;
insert into public.integration_connections(workspace_id,project_id,provider,config,source)
select workspace_id,id,'meta_ads','{"account_id":"2653764958003882","page_id":"100290601664186","app_id":"4452503888399253"}','server' from public.records
where id='62cc634e-0f9f-4433-8103-8660086d8bd3' and workspace_id='3d9cce7e-5a87-4cc7-8b7a-6210457b4fd3' and kind='project';

create or replace function public.save_experiment_preparation(p_record jsonb,p_expected timestamptz default null)
returns setof public.records language plpgsql security definer set search_path='' as $$
declare saved public.records; previous_fields jsonb; plan jsonb; variant jsonb; total_allocation numeric;begin
 if auth.uid() is null or not public.can_record_action((p_record->>'workspace_id')::uuid,'experiment',case when p_expected is null then 'create' else 'edit' end) then raise exception 'No tienes permiso para guardar este experimento';end if;
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if jsonb_typeof(p_record)<>'object' then raise exception 'Ficha inválida';end if;
 if p_expected is null then
  insert into public.records(id,workspace_id,project_id,kind,title,owner_id,parent_id,related_id,fields)
   values((p_record->>'id')::uuid,(p_record->>'workspace_id')::uuid,(p_record->>'project_id')::uuid,'experiment',p_record->>'title',nullif(p_record->>'owner_id','')::uuid,nullif(p_record->>'parent_id','')::uuid,nullif(p_record->>'related_id','')::uuid,p_record->'fields') returning * into saved;
 else
  select fields into previous_fields from public.records where id=(p_record->>'id')::uuid and workspace_id=(p_record->>'workspace_id')::uuid and project_id=(p_record->>'project_id')::uuid and kind='experiment' for update;
  update public.records set title=p_record->>'title',owner_id=nullif(p_record->>'owner_id','')::uuid,parent_id=nullif(p_record->>'parent_id','')::uuid,related_id=nullif(p_record->>'related_id','')::uuid,fields=p_record->'fields'
   where id=(p_record->>'id')::uuid and workspace_id=(p_record->>'workspace_id')::uuid and project_id=(p_record->>'project_id')::uuid and kind='experiment' and updated_at=p_expected returning * into saved;
  if saved.id is null then raise exception 'Otra persona ha modificado la ficha o no tienes acceso. Actualiza antes de guardar.';end if;
 end if;
 if saved.fields ? 'execution_config' and ((saved.fields->'execution_config') is distinct from (previous_fields->'execution_config') or (saved.fields->'start') is distinct from (previous_fields->'start')) then
  plan:=(saved.fields->>'execution_config')::jsonb;
  if jsonb_typeof(plan->'variants')<>'array' or jsonb_array_length(plan->'variants')>6 then raise exception 'Variantes inválidas';end if;
  if plan->>'currency' is not null and plan->>'currency' !~ '^[A-Z]{3}$' then raise exception 'Moneda inválida';end if;
  if plan->>'duration_days' is not null and ((plan->>'duration_days')::numeric not between 1 and 365 or (plan->>'duration_days')::numeric<>trunc((plan->>'duration_days')::numeric)) then raise exception 'Duración inválida';end if;
  if (select count(*) from jsonb_array_elements(plan->'variants'))<>(select count(distinct lower(trim(v->>'label'))) from jsonb_array_elements(plan->'variants') v) then raise exception 'Nombres de variantes duplicados';end if;
  if jsonb_array_length(plan->'variants')>0 and not exists(select 1 from jsonb_array_elements(plan->'variants') v where v->>'allocation' is null) then
   select sum((v->>'allocation')::numeric) into total_allocation from jsonb_array_elements(plan->'variants') v;
   if abs(total_allocation-100)>0.01 then raise exception 'El reparto debe sumar 100 por ciento';end if;
  end if;
  update public.experiment_specs set budget=coalesce((plan->>'daily_budget')::numeric,budget),currency=coalesce(plan->>'currency',currency),
   budget_period=case when plan->>'daily_budget' is not null then 'daily' else budget_period end,
   planned_start=coalesce(nullif(saved.fields->>'start','')::date,planned_start),
   planned_end=case when nullif(saved.fields->>'start','') is not null and plan->>'duration_days' is not null then (saved.fields->>'start')::date+(plan->>'duration_days')::integer-1 else planned_end end
   where experiment_id=saved.id;
  for variant in select * from jsonb_array_elements(plan->'variants') loop
   insert into public.experiment_variants(workspace_id,project_id,experiment_id,label,description,allocation)
    values(saved.workspace_id,saved.project_id,saved.id,trim(variant->>'label'),concat_ws(E'\n',variant->>'description','Titular: '||(variant->>'headline'),'Texto: '||(variant->>'body'),'CTA: '||(variant->>'call_to_action')),(variant->>'allocation')::numeric)
    on conflict(experiment_id,label) do update set description=excluded.description,allocation=coalesce(excluded.allocation,public.experiment_variants.allocation);
  end loop;
 end if;
 return next saved;
end $$;

create or replace function public.reserve_meta_campaign(p_experiment uuid,p_request uuid,p_fingerprint text,p_expected timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare experiment public.records; job public.meta_campaign_preparations;
begin
  select * into experiment from public.records where id=p_experiment and kind='experiment' for update;
  if auth.uid() is null or experiment.id is null or not public.can_record_action(experiment.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar esta campaña';end if;
  if experiment.updated_at is distinct from p_expected then raise exception 'El experimento cambió. Revisa de nuevo la preparación';end if;
  if experiment.fields->>'channel' is distinct from 'meta_ads' then raise exception 'El canal debe ser Meta Ads';end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_request is null then raise exception 'Solicitud inválida';end if;
  select * into job from public.meta_campaign_preparations where experiment_id=p_experiment;
  if job.experiment_id is not null and job.status<>'rejected' then raise exception 'La creación ya fue solicitada. Consulta Ads Manager y los recursos vinculados antes de repetir';end if;
  insert into public.meta_campaign_preparations(experiment_id,workspace_id,project_id,request_id,created_by,fingerprint,status)
    values(experiment.id,experiment.workspace_id,experiment.project_id,p_request,auth.uid(),p_fingerprint,'pending')
    on conflict(experiment_id) do update set request_id=excluded.request_id,created_by=excluded.created_by,fingerprint=excluded.fingerprint,status='pending',updated_at=now();
  return p_request;
end $$;

create or replace function public.finish_meta_campaign(p_request uuid,p_status text,p_external text default null,p_label text default '') returns void
language plpgsql security definer set search_path='' as $$
declare job public.meta_campaign_preparations;
begin
  select * into job from public.meta_campaign_preparations where request_id=p_request for update;
  if auth.uid() is null or job.request_id is null or job.created_by<>auth.uid() or not public.can_record_action(job.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para completar esta solicitud';end if;
  if job.status<>'pending' or p_status not in ('linked','rejected','uncertain') then raise exception 'Esta solicitud ya fue procesada';end if;
  if (p_status='linked') is distinct from (p_external is not null) then raise exception 'Resultado inválido';end if;
  if p_status='linked' then
    if p_external !~ '^[0-9]{1,30}$' or length(p_label)>200 then raise exception 'Recurso inválido';end if;
    insert into public.external_resources(workspace_id,project_id,experiment_id,provider,resource_type,external_id,label,observed_status)
      values(job.workspace_id,job.project_id,job.experiment_id,'meta_ads','campaign',p_external,p_label,'paused')
      on conflict(experiment_id,provider,resource_type,external_id) do nothing;
  end if;
  update public.meta_campaign_preparations set status=p_status,external_id=p_external,updated_at=now() where request_id=p_request;
end $$;

create or replace function public.reserve_ai_preparation(p_workspace uuid,p_request uuid) returns numeric
language plpgsql security definer set search_path='' as $$
declare spent numeric;
begin
  if auth.uid() is null or not (public.can_record_action(p_workspace,'experiment','create') or public.can_record_action(p_workspace,'experiment','edit')) then raise exception 'Solo administradores y editores pueden utilizar la IA'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ai:' || p_workspace::text,0));
  if exists(select 1 from public.ai_preparation_usage where request_id=p_request) then raise exception 'Esta solicitud ya fue procesada'; end if;
  if exists(select 1 from public.ai_preparation_usage where workspace_id=p_workspace and created_at>now()-interval '15 seconds') then raise exception 'Espera 15 segundos antes de otra consulta'; end if;
  select coalesce(sum(reserved_usd),0) into spent from public.ai_preparation_usage where workspace_id=p_workspace and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  if spent+0.03>5 then raise exception 'Se ha alcanzado el límite mensual de IA de 5 USD'; end if;
  insert into public.ai_preparation_usage(request_id,workspace_id,user_id) values(p_request,p_workspace,auth.uid());
  return spent+0.03;
end $$;

notify pgrst,'reload schema';
commit;
