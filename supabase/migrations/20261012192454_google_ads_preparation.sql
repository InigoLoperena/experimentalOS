begin;
create table public.google_ads_preparations(
 id uuid primary key,
 experiment_id uuid not null,
 workspace_id uuid not null,
 project_id uuid not null,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 revision timestamptz not null,
 account_id text not null check(account_id ~ '^[0-9]{10}$'),
 created_by uuid not null references auth.users(id),
 status text not null check(status in ('pending','succeeded','rejected','uncertain')),
 result jsonb not null default '[]' check(jsonb_typeof(result)='array' and octet_length(result::text)<5000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(experiment_id,fingerprint),
 foreign key(experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade
);
create index google_ads_preparations_scope on public.google_ads_preparations(workspace_id,project_id,experiment_id);
alter table public.google_ads_preparations enable row level security;
revoke all on public.google_ads_preparations from public,anon,authenticated;
grant select on public.google_ads_preparations to authenticated;
create policy google_ads_preparations_read on public.google_ads_preparations for select to authenticated using(public.is_member(workspace_id));
create function experimental_private.reserve_google_ads(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_account text) returns uuid
language plpgsql security definer set search_path='' as $$
declare e public.records; old public.google_ads_preparations;
begin
 select * into e from public.records where id=p_experiment and kind='experiment' for update;
 if auth.uid() is null or e.id is null or not public.can_record_action(e.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para preparar este experimento';end if;
 if e.updated_at is distinct from p_revision or e.fields->>'channel' is distinct from 'google_ads' then raise exception 'La ficha cambió. Revisa de nuevo';end if;
 if p_id is null or coalesce(p_fingerprint,'') !~ '^[a-f0-9]{64}$' or coalesce(p_account,'') !~ '^[0-9]{10}$' then raise exception 'Solicitud inválida';end if;
 if exists(select 1 from public.google_ads_preparations where experiment_id=e.id and status in ('pending','uncertain')) then raise exception 'Hay un envío sin confirmar. Comprueba Google Ads antes de repetir';end if;
 select * into old from public.google_ads_preparations where experiment_id=e.id and fingerprint=p_fingerprint;
 if old.id is not null and old.status<>'rejected' then raise exception 'Esta preparación ya se envió. Consulta sus recursos vinculados';end if;
 insert into public.google_ads_preparations(id,experiment_id,workspace_id,project_id,fingerprint,revision,account_id,created_by,status)
 values(p_id,e.id,e.workspace_id,e.project_id,p_fingerprint,p_revision,p_account,auth.uid(),'pending')
 on conflict(experiment_id,fingerprint) do update set id=p_id,created_by=auth.uid(),status='pending',result='[]',updated_at=now();
 return p_id;
end $$;
create function public.reserve_google_ads(p_id uuid,p_experiment uuid,p_fingerprint text,p_revision timestamptz,p_account text) returns uuid
language sql security invoker set search_path='' as $$select experimental_private.reserve_google_ads(p_id,p_experiment,p_fingerprint,p_revision,p_account)$$;
create function experimental_private.finish_google_ads(p_id uuid,p_status text,p_resources jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.google_ads_preparations; item jsonb;
begin
 select * into r from public.google_ads_preparations where id=p_id for update;
 if auth.uid() is null or r.id is null or r.created_by<>auth.uid() or not public.can_record_action(r.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para completar este envío';end if;
 if r.status<>'pending' or p_status is null or p_status not in ('succeeded','rejected','uncertain') or p_resources is null or jsonb_typeof(p_resources)<>'array' then raise exception 'Resultado inválido';end if;
 if p_status='succeeded' then
  if jsonb_array_length(p_resources)<>4 then raise exception 'Faltan recursos de Google Ads';end if;
  if (select count(*) from jsonb_array_elements(p_resources) x where x->>'type'='campaign')<>1 or (select count(*) from jsonb_array_elements(p_resources) x where x->>'type'='adset')<>1 or (select count(*) from jsonb_array_elements(p_resources) x where x->>'type'='ad')<>2 then raise exception 'Tipos de recurso inválidos';end if;
  for item in select * from jsonb_array_elements(p_resources) loop
   if coalesce(item->>'id','') !~ '^[0-9]{1,30}$' or length(coalesce(item->>'label',''))>250 then raise exception 'ID o nombre inválidos';end if;
   if item->>'type'='ad' then
    if not exists(select 1 from public.experiment_variants where id=(item->>'variant')::uuid and experiment_id=r.experiment_id and workspace_id=r.workspace_id and project_id=r.project_id) then raise exception 'Variante inválida';end if;
   elsif item->>'variant' is not null then raise exception 'La campaña o grupo no se asigna a una variante';end if;
   insert into public.external_resources(workspace_id,project_id,experiment_id,variant_id,provider,resource_type,external_id,label,observed_status)
   values(r.workspace_id,r.project_id,r.experiment_id,(item->>'variant')::uuid,'google_ads',item->>'type',item->>'id',coalesce(item->>'label',''),'paused');
  end loop;
 elsif jsonb_array_length(p_resources)<>0 then raise exception 'No guardes recursos sin confirmar';end if;
 update public.google_ads_preparations set status=p_status,result=p_resources,updated_at=now() where id=p_id;
end $$;
create function public.finish_google_ads(p_id uuid,p_status text,p_resources jsonb) returns void
language sql security invoker set search_path='' as $$select experimental_private.finish_google_ads(p_id,p_status,p_resources)$$;
revoke all on function experimental_private.reserve_google_ads(uuid,uuid,text,timestamptz,text),public.reserve_google_ads(uuid,uuid,text,timestamptz,text),experimental_private.finish_google_ads(uuid,text,jsonb),public.finish_google_ads(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function experimental_private.reserve_google_ads(uuid,uuid,text,timestamptz,text),public.reserve_google_ads(uuid,uuid,text,timestamptz,text),experimental_private.finish_google_ads(uuid,text,jsonb),public.finish_google_ads(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
