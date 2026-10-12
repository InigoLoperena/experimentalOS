begin;
-- The new signup flow may run in several tabs. Reuse the user's membership
-- under the same lock rather than creating duplicate empty teams.
create or replace function experimental_private.create_team(team_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para crear tu equipo';end if;
 if team_name is null or length(trim(team_name)) not between 1 and 120 then raise exception 'Nombre de equipo inválido';end if;
 perform pg_advisory_xact_lock(hashtextextended('experimental-team:'||auth.uid()::text,0));
 select m.workspace_id into w from public.members m join public.workspaces s on s.id=m.workspace_id where m.user_id=auth.uid() order by s.created_at,s.id limit 1;
 if w is not null then return w;end if;
 insert into public.workspaces(name,created_by) values(trim(team_name),auth.uid()) returning id into w;
 insert into public.members(workspace_id,user_id,role) values(w,auth.uid(),'owner');return w;
end $$;
create table public.meta_preparation_runs(
 id uuid primary key,
 experiment_id uuid not null,
 workspace_id uuid not null,
 project_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 revision timestamptz not null,
 selection jsonb not null check(jsonb_typeof(selection)='object' and octet_length(selection::text)<25000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,experiment_id,workspace_id,project_id),
 unique(experiment_id,fingerprint),
 foreign key(experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade
);
create table public.meta_preparation_steps(
 run_id uuid not null,
 step_key text not null check(step_key ~ '^(campaign|v[0-5]_(feed|story|reels)_(media|thumbnail|adset|creative|ad))$'),
 experiment_id uuid not null,
 workspace_id uuid not null,
 project_id uuid not null,
 request_id uuid not null unique,
 created_by uuid not null references auth.users(id),
 status text not null check(status in ('pending','succeeded','rejected','uncertain')),
 result jsonb not null default '{}' check(jsonb_typeof(result)='object' and octet_length(result::text)<500),
 updated_at timestamptz not null default now(),
 primary key(run_id,step_key),
 foreign key(run_id,experiment_id,workspace_id,project_id) references public.meta_preparation_runs(id,experiment_id,workspace_id,project_id) on delete cascade
);
alter table public.meta_preparation_runs enable row level security;
alter table public.meta_preparation_steps enable row level security;
revoke all on public.meta_preparation_runs,public.meta_preparation_steps from public,anon,authenticated;
grant select on public.meta_preparation_runs,public.meta_preparation_steps to authenticated;
create policy meta_runs_read on public.meta_preparation_runs for select to authenticated using(public.is_member(workspace_id));
create policy meta_steps_read on public.meta_preparation_steps for select to authenticated using(public.is_member(workspace_id));
create index meta_runs_scope on public.meta_preparation_runs(workspace_id,project_id,experiment_id);
create index meta_steps_scope on public.meta_preparation_steps(workspace_id,project_id,experiment_id);

-- Only narrow RPCs can mutate receipts. Invoker wrappers keep definer internals private.
create function experimental_private.begin_meta_run(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_selection jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.records; existing uuid;
begin
 select * into e from public.records where id=p_experiment and kind='experiment' for update;
 if auth.uid() is null or e.id is null or not public.can_record_action(e.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar este experimento';end if;
 if e.updated_at is distinct from p_revision or e.fields->>'channel' is distinct from 'meta_ads' then raise exception 'La ficha cambió. Revisa de nuevo';end if;
 if p_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_selection is null then raise exception 'Solicitud inválida';end if;
 select id into existing from public.meta_preparation_runs where experiment_id=e.id and fingerprint=p_fingerprint;
 if existing is not null then return existing;end if;
 insert into public.meta_preparation_runs values(p_id,e.id,e.workspace_id,e.project_id,p_fingerprint,p_revision,p_selection,auth.uid(),now());
 return p_id;
end $$;
create function public.begin_meta_run(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_selection jsonb) returns uuid
language sql security invoker set search_path='' as $$select experimental_private.begin_meta_run(p_id,p_experiment,p_fingerprint,p_revision,p_selection)$$;
create function experimental_private.reserve_meta_step(p_run uuid,p_step text,p_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.meta_preparation_runs; old public.meta_preparation_steps;
begin
 select * into r from public.meta_preparation_runs where id=p_run;
 if auth.uid() is null or r.id is null or not public.can_record_action(r.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar este experimento';end if;
 perform 1 from public.records where id=r.experiment_id for update;
 if not exists(select 1 from public.records where id=r.experiment_id and updated_at=r.revision) then raise exception 'La ficha cambió. Revisa de nuevo';end if;
 perform 1 from public.meta_preparation_runs where id=p_run for update;
 select * into old from public.meta_preparation_steps where run_id=p_run and step_key=p_step;
 if old.run_id is not null and old.status<>'rejected' then raise exception 'Este paso ya fue solicitado. No lo repitas: comprueba Meta';end if;
 -- Serialize writes across runs of the same experiment as well.
 if exists(select 1 from public.meta_preparation_steps where experiment_id=r.experiment_id and status in ('pending','uncertain')) then raise exception 'Hay una operación sin confirmar. Revisa Ads Manager antes de continuar';end if;
 if exists(select 1 from public.meta_campaign_preparations where experiment_id=r.experiment_id and status in ('pending','uncertain')) then raise exception 'Hay una creación de campaña sin confirmar. Revisa Ads Manager';end if;
 insert into public.meta_preparation_steps(run_id,step_key,experiment_id,workspace_id,project_id,request_id,created_by,status)
 values(r.id,p_step,r.experiment_id,r.workspace_id,r.project_id,p_request,auth.uid(),'pending')
 on conflict(run_id,step_key) do update set request_id=excluded.request_id,created_by=excluded.created_by,status='pending',result='{}',updated_at=now();
end $$;
create function public.reserve_meta_step(p_run uuid,p_step text,p_request uuid) returns void language sql security invoker set search_path='' as $$select experimental_private.reserve_meta_step(p_run,p_step,p_request)$$;
create function experimental_private.finish_meta_step(p_request uuid,p_status text,p_result jsonb,p_type text default null,p_variant uuid default null,p_label text default '') returns void
language plpgsql security definer set search_path='' as $$
declare s public.meta_preparation_steps;
begin
 select * into s from public.meta_preparation_steps where request_id=p_request for update;
 if auth.uid() is null or s.run_id is null or s.created_by<>auth.uid() or not public.can_record_action(s.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para completar el paso';end if;
 if s.status<>'pending' or p_status not in ('succeeded','rejected','uncertain') or p_result is null then raise exception 'Este paso ya fue procesado';end if;
 if exists(select 1 from jsonb_object_keys(p_result) k where k not in ('id','hash')) then raise exception 'Resultado inválido';end if;
 if p_status='succeeded' and not (coalesce(p_result->>'id','') ~ '^[0-9]{1,30}$' or coalesce(p_result->>'hash','') ~ '^[a-f0-9]{32}$') then raise exception 'Falta el identificador externo';end if;
 if p_type is not null then
  if p_status<>'succeeded' or p_type not in ('campaign','adset','ad') or p_result->>'id' !~ '^[0-9]{1,30}$' then raise exception 'Recurso inválido';end if;
  insert into public.external_resources(workspace_id,project_id,experiment_id,variant_id,provider,resource_type,external_id,label,observed_status)
  values(s.workspace_id,s.project_id,s.experiment_id,p_variant,'meta_ads',p_type,p_result->>'id',p_label,'paused')
  on conflict(experiment_id,provider,resource_type,external_id) do nothing;
 end if;
 update public.meta_preparation_steps set status=p_status,result=p_result,updated_at=now() where request_id=p_request;
end $$;
create function public.finish_meta_step(p_request uuid,p_status text,p_result jsonb,p_type text default null,p_variant uuid default null,p_label text default '') returns void
language sql security invoker set search_path='' as $$select experimental_private.finish_meta_step(p_request,p_status,p_result,p_type,p_variant,p_label)$$;
revoke all on function experimental_private.begin_meta_run(uuid,uuid,text,timestamptz,jsonb),public.begin_meta_run(uuid,uuid,text,timestamptz,jsonb),experimental_private.reserve_meta_step(uuid,text,uuid),public.reserve_meta_step(uuid,text,uuid),experimental_private.finish_meta_step(uuid,text,jsonb,text,uuid,text),public.finish_meta_step(uuid,text,jsonb,text,uuid,text) from public,anon,authenticated;
grant execute on function experimental_private.begin_meta_run(uuid,uuid,text,timestamptz,jsonb),public.begin_meta_run(uuid,uuid,text,timestamptz,jsonb),experimental_private.reserve_meta_step(uuid,text,uuid),public.reserve_meta_step(uuid,text,uuid),experimental_private.finish_meta_step(uuid,text,jsonb,text,uuid,text),public.finish_meta_step(uuid,text,jsonb,text,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
