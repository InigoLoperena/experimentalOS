begin;
create table public.smartlead_preparations(
 id uuid primary key,
 experiment_id uuid not null,
 workspace_id uuid not null,
 project_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 revision timestamptz not null,
 account_id text not null check(account_id ~ '^[a-f0-9]{64}$'),
 created_by uuid not null references auth.users(id),
 status text not null check(status in ('pending','succeeded','rejected','uncertain')),
 result jsonb not null default '[]' check(jsonb_typeof(result)='array' and octet_length(result::text)<5000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(experiment_id,fingerprint),
 foreign key(experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade
);
create index smartlead_preparations_scope on public.smartlead_preparations(workspace_id,project_id,experiment_id);
alter table public.smartlead_preparations enable row level security;
revoke all on public.smartlead_preparations from public,anon,authenticated;
grant select on public.smartlead_preparations to authenticated;
create policy smartlead_preparations_read on public.smartlead_preparations for select to authenticated using(public.is_member(workspace_id));
create function experimental_private.reserve_smartlead(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_account text) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.records; old public.smartlead_preparations;
begin
 select * into e from public.records where id=p_experiment and kind='experiment' for update;
 if auth.uid() is null or e.id is null or not public.can_record_action(e.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar este experimento';end if;
 if e.updated_at is distinct from p_revision or e.fields->>'channel' is distinct from 'smartlead' then raise exception 'La ficha cambió. Revisa de nuevo';end if;
 if p_id is null or coalesce(p_fingerprint,'') !~ '^[a-f0-9]{64}$' or coalesce(p_account,'') !~ '^[a-f0-9]{64}$' then raise exception 'Solicitud inválida';end if;
 if exists(select 1 from public.smartlead_preparations where experiment_id=e.id and status in ('pending','uncertain')) then raise exception 'Hay un envío sin confirmar. Comprueba Smartlead antes de repetir';end if;
 select * into old from public.smartlead_preparations where experiment_id=e.id and fingerprint=p_fingerprint;
 if old.id is not null and old.status<>'rejected' then raise exception 'Esta preparación ya se envió. Consulta sus recursos vinculados';end if;
 insert into public.smartlead_preparations(id,experiment_id,workspace_id,project_id,fingerprint,revision,account_id,created_by,status)
 values(p_id,e.id,e.workspace_id,e.project_id,p_fingerprint,p_revision,p_account,auth.uid(),'pending')
 on conflict(experiment_id,fingerprint) do update set id=p_id,created_by=auth.uid(),status='pending',result='[]',updated_at=now();
 return p_id;
end $$;
create function public.reserve_smartlead(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_account text) returns uuid
language sql security invoker set search_path='' as $$select experimental_private.reserve_smartlead(p_id,p_experiment,p_fingerprint,p_revision,p_account)$$;
create function experimental_private.finish_smartlead(p_id uuid,p_status text,p_resources jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.smartlead_preparations; item jsonb;
begin
 select * into r from public.smartlead_preparations where id=p_id for update;
 if auth.uid() is null or r.id is null or r.created_by<>auth.uid() or not public.can_record_action(r.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para completar este envío';end if;
 if r.status<>'pending' or p_status is null or p_status not in ('pending','succeeded','rejected','uncertain') or p_resources is null or jsonb_typeof(p_resources)<>'array' then raise exception 'Resultado inválido';end if;
 if jsonb_array_length(r.result)>0 and r.result is distinct from p_resources then raise exception 'El ID confirmado no puede cambiar';end if;
 if jsonb_array_length(p_resources)>1 then raise exception 'Recurso inválido';end if;
 if p_status='succeeded' and jsonb_array_length(p_resources)<>1 then raise exception 'Falta la campaña';end if;
 for item in select * from jsonb_array_elements(p_resources) loop
  if item->>'type' is distinct from 'campaign' or coalesce(item->>'id','') !~ '^[1-9][0-9]{0,15}$' or item->>'variant' is not null or length(coalesce(item->>'label',''))>250 then raise exception 'Recurso inválido';end if;
  if not exists(select 1 from public.external_resources where experiment_id=r.experiment_id and provider='smartlead' and resource_type='campaign' and external_id=item->>'id') then
  insert into public.external_resources(workspace_id,project_id,experiment_id,provider,resource_type,external_id,label,observed_status)
  values(r.workspace_id,r.project_id,r.experiment_id,'smartlead','campaign',item->>'id',coalesce(item->>'label',''),'draft');end if;
 end loop;
 update public.smartlead_preparations set status=p_status,result=p_resources,updated_at=now() where id=p_id;
end $$;
create function public.finish_smartlead(p_id uuid,p_status text,p_resources jsonb) returns void
language sql security invoker set search_path='' as $$select experimental_private.finish_smartlead(p_id,p_status,p_resources)$$;
revoke all on function experimental_private.reserve_smartlead(uuid,uuid,text,timestamptz,text),public.reserve_smartlead(uuid,uuid,text,timestamptz,text),experimental_private.finish_smartlead(uuid,text,jsonb),public.finish_smartlead(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function experimental_private.reserve_smartlead(uuid,uuid,text,timestamptz,text),public.reserve_smartlead(uuid,uuid,text,timestamptz,text),experimental_private.finish_smartlead(uuid,text,jsonb),public.finish_smartlead(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
