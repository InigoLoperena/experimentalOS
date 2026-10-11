begin;
-- One initial campaign container per experiment. A pending/ambiguous request
-- cannot be retried automatically; external APIs and Postgres are not atomic.
create table public.meta_campaign_preparations(
  experiment_id uuid primary key,
  workspace_id uuid not null,
  project_id uuid not null,
  request_id uuid not null unique,
  created_by uuid not null references auth.users(id),
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null check(status in ('pending','linked','rejected','uncertain')),
  external_id text check(external_id ~ '^[0-9]{1,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade,
  check((status='linked')=(external_id is not null))
);
alter table public.meta_campaign_preparations enable row level security;
revoke all on public.meta_campaign_preparations from public,anon,authenticated;
grant select on public.meta_campaign_preparations to authenticated;
create policy meta_preparation_read on public.meta_campaign_preparations for select to authenticated using(public.is_member(workspace_id));
create index meta_preparation_workspace on public.meta_campaign_preparations(workspace_id,project_id);

create function public.reserve_meta_campaign(p_experiment uuid,p_request uuid,p_fingerprint text,p_expected timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare experiment public.records; job public.meta_campaign_preparations;
begin
  select * into experiment from public.records where id=p_experiment and kind='experiment' for update;
  if auth.uid() is null or experiment.id is null or coalesce(public.member_role(experiment.workspace_id),'') not in ('owner','editor') then raise exception 'No tienes permiso para preparar esta campaña';end if;
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
create function public.finish_meta_campaign(p_request uuid,p_status text,p_external text default null,p_label text default '') returns void
language plpgsql security definer set search_path='' as $$
declare job public.meta_campaign_preparations;
begin
  select * into job from public.meta_campaign_preparations where request_id=p_request for update;
  if auth.uid() is null or job.request_id is null or job.created_by<>auth.uid() or coalesce(public.member_role(job.workspace_id),'') not in ('owner','editor') then raise exception 'No tienes permiso para completar esta solicitud';end if;
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
-- These are edit operations, like manual campaign linking, not authenticated API
-- metric evidence. Only the server holds the Meta credential and can call Meta.
revoke all on function public.reserve_meta_campaign(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.finish_meta_campaign(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_meta_campaign(uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.finish_meta_campaign(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
