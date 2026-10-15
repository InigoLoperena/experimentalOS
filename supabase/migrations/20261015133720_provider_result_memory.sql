begin;
create table public.provider_result_snapshots (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,experiment_id uuid not null,resource_id uuid not null,
 provider text not null,data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=1000000),
 fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),period_start date,period_end date,
 observed_on date not null default (now() at time zone 'UTC')::date,created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 foreign key(resource_id,workspace_id,project_id,experiment_id) references public.external_resources(id,workspace_id,project_id,experiment_id) on delete cascade,
 unique(resource_id,observed_on,fingerprint),check(period_start is null or period_end>=period_start)
);
alter table public.provider_result_snapshots enable row level security;
revoke all on public.provider_result_snapshots from public,anon,authenticated;
grant select,insert on public.provider_result_snapshots to authenticated;
create policy provider_result_read on public.provider_result_snapshots for select to authenticated using(public.is_member(workspace_id));
create policy provider_result_add on public.provider_result_snapshots for insert to authenticated with check(created_by=(select auth.uid()) and public.can_record_action(workspace_id,'experiment','edit'));
create index provider_result_scope on public.provider_result_snapshots(workspace_id,project_id,created_at);
create index provider_result_author on public.provider_result_snapshots(created_by);
create trigger ai_memory_index after insert or delete on public.provider_result_snapshots for each row execute function experimental_private.refresh_ai_memory();
create function public.save_provider_result(r uuid,p_data jsonb,p_hash text,p_start date,p_end date,p_metrics jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare linked public.external_resources; entry jsonb;begin
 select * into linked from public.external_resources where id=r;
 if linked.id is null or not public.can_record_action(linked.workspace_id,'experiment','edit') then raise exception 'No tienes permiso para guardar resultados';end if;
 if jsonb_typeof(p_metrics)<>'array' or jsonb_array_length(p_metrics)>300 then raise exception 'Métricas no válidas';end if;
 insert into public.provider_result_snapshots(workspace_id,project_id,experiment_id,resource_id,provider,data,fingerprint,period_start,period_end)
 values(linked.workspace_id,linked.project_id,linked.experiment_id,linked.id,linked.provider,p_data,p_hash,p_start,p_end) on conflict(resource_id,observed_on,fingerprint) do nothing;
 for entry in select value from jsonb_array_elements(p_metrics) loop
  if entry->>'external_id' is distinct from linked.external_id then raise exception 'La métrica pertenece a otro recurso';end if;
  insert into public.metric_observations(workspace_id,project_id,experiment_id,resource_id,metric,unit,currency,value,period_start,period_end,source,notes)
  -- User-initiated import under their JWT. Do not bypass the protected API-writer policies.
  values(linked.workspace_id,linked.project_id,linked.experiment_id,linked.id,entry->>'metric',entry->>'unit',entry->>'currency',(entry->>'value')::numeric,(entry->>'period_start')::date,(entry->>'period_end')::date,'manual',coalesce(entry->>'notes',''))
  on conflict(resource_id,metric,period_start,period_end) do update set value=excluded.value,unit=excluded.unit,currency=excluded.currency,source='manual',notes=excluded.notes;
 end loop;
end $$;
revoke all on function public.save_provider_result(uuid,jsonb,text,date,date,jsonb) from public,anon;
grant execute on function public.save_provider_result(uuid,jsonb,text,date,date,jsonb) to authenticated;
notify pgrst,'reload schema';commit;
