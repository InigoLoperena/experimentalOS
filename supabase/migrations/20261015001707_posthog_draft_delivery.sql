begin;
-- Extend only the channel list; preserve the current trigger and all existing records.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.validate_record()'::regprocedure);
 if position('''posthog'',''web_app''' in definition)=0 then
  if position('not in (''web_app'',''mobile_ios''' in definition)=0 then raise exception 'Revisa la lista actual de canales antes de aplicar PostHog';end if;
  execute replace(definition,'not in (''web_app'',''mobile_ios''','not in (''posthog'',''web_app'',''mobile_ios''');
 end if;
end $$;
create table public.posthog_preparations(
 id uuid primary key,experiment_id uuid not null,workspace_id uuid not null,project_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),revision timestamptz not null,
 host text not null check(host in ('https://us.posthog.com','https://eu.posthog.com','https://app.posthog.com')),
 external_project_id text not null check(external_project_id ~ '^[0-9]+$'),flag_key text not null,
 created_by uuid not null references auth.users(id),
 status text not null check(status in ('pending','succeeded','rejected','uncertain')),
 external_id text check(external_id ~ '^[1-9][0-9]*$'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade
);
create index posthog_preparations_scope on public.posthog_preparations(workspace_id,project_id,experiment_id);
create index posthog_preparations_actor on public.posthog_preparations(created_by);
alter table public.posthog_preparations enable row level security;
revoke all on public.posthog_preparations from public,anon,authenticated;
grant select on public.posthog_preparations to authenticated;
create policy posthog_preparations_read on public.posthog_preparations for select to authenticated using(public.is_member(workspace_id));
create function experimental_private.reserve_posthog(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_host text,p_project text) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.records;begin
 select * into e from public.records where id=p_experiment and kind='experiment' for update;
 if auth.uid() is null or e.id is null or not public.can_record_action(e.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar este experimento';end if;
 if e.updated_at is distinct from p_revision or coalesce(e.fields->>'channel','') not in ('posthog','web_app','mobile_ios','mobile_android') then raise exception 'La ficha cambió. Revisa de nuevo';end if;
 if coalesce(e.fields->>'posthog_experiment_id','')<>'' or exists(select 1 from public.external_resources where experiment_id=e.id and provider='posthog' and resource_type='experiment') then raise exception 'Ya hay un experimento vinculado a PostHog';end if;
 if exists(select 1 from public.posthog_preparations where experiment_id=e.id and status<>'rejected') then raise exception 'Hay un envío guardado o sin confirmar. Actualiza el estado antes de repetir';end if;
 if p_id is null or coalesce(p_fingerprint,'') !~ '^[a-f0-9]{64}$' then raise exception 'Solicitud inválida';end if;
 insert into public.posthog_preparations(id,experiment_id,workspace_id,project_id,fingerprint,revision,host,external_project_id,flag_key,created_by,status)
 values(p_id,e.id,e.workspace_id,e.project_id,p_fingerprint,p_revision,p_host,p_project,'xperiments-'||e.id::text,auth.uid(),'pending');
 return p_id;
end $$;
create function public.reserve_posthog(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_host text,p_project text) returns uuid
language sql security invoker set search_path='' as $$select experimental_private.reserve_posthog(p_id,p_experiment,p_fingerprint,p_revision,p_host,p_project)$$;
create function experimental_private.finish_posthog(p_id uuid,p_status text,p_external text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.posthog_preparations;e public.records;begin
 select * into r from public.posthog_preparations where id=p_id for update;
 if auth.uid() is null or r.id is null or r.created_by<>auth.uid() or not public.can_record_action(r.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para completar este envío';end if;
 if r.status not in ('pending','uncertain') or p_status is null or p_status not in ('succeeded','rejected','uncertain') then raise exception 'Estado inválido';end if;
 if p_external is not null and p_external !~ '^[1-9][0-9]*$' then raise exception 'ID inválido';end if;
 if r.external_id is not null and r.external_id is distinct from p_external then raise exception 'El ID confirmado no puede cambiar';end if;
 if p_status='succeeded' and p_external is null then raise exception 'Falta el ID externo';end if;
 if p_external is not null then
  select * into e from public.records where id=r.experiment_id for update;
  if coalesce(e.fields->>'posthog_experiment_id','') not in ('',p_external) then raise exception 'Otro experimento ya está vinculado';end if;
  insert into public.external_resources(workspace_id,project_id,experiment_id,provider,resource_type,external_id,external_url,label,observed_status)
   values(r.workspace_id,r.project_id,r.experiment_id,'posthog','experiment',p_external,r.host||'/project/'||r.external_project_id||'/experiments/'||p_external,left('Experimento · '||e.title,200),'draft') on conflict(experiment_id,provider,resource_type,external_id) do nothing;
  update public.records set fields=fields||jsonb_build_object('posthog_experiment_id',p_external) where id=e.id;
 end if;
 update public.posthog_preparations set status=p_status,external_id=coalesce(p_external,external_id),updated_at=clock_timestamp() where id=p_id;
end $$;
create function public.finish_posthog(p_id uuid,p_status text,p_external text default null) returns void
language sql security invoker set search_path='' as $$select experimental_private.finish_posthog(p_id,p_status,p_external)$$;
revoke all on function experimental_private.reserve_posthog(uuid,uuid,text,timestamptz,text,text),public.reserve_posthog(uuid,uuid,text,timestamptz,text,text),experimental_private.finish_posthog(uuid,text,text),public.finish_posthog(uuid,text,text) from public,anon,authenticated;
grant execute on function experimental_private.reserve_posthog(uuid,uuid,text,timestamptz,text,text),public.reserve_posthog(uuid,uuid,text,timestamptz,text,text),experimental_private.finish_posthog(uuid,text,text),public.finish_posthog(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
