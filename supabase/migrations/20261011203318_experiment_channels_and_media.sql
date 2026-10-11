begin;
-- Allow Experimental OS experiments to store the PostHog experiment identifier.
-- The PostHog API key is intentionally NOT stored in Supabase records.
-- It must live only in the server environment as POSTHOG_PERSONAL_API_KEY.

create or replace function public.validate_record() returns trigger
language plpgsql security definer set search_path=public as $$
declare pk text; expected text; k text; parent_project uuid; begin
 if tg_op='UPDATE' and (new.workspace_id<>old.workspace_id or new.id<>old.id or new.kind<>old.kind or new.project_id is distinct from old.project_id) then
  raise exception 'La identidad, el tipo y el proyecto no se pueden cambiar';
 end if;
 if new.kind='project' then
  if new.project_id is not null then raise exception 'Un proyecto no puede pertenecer a otro proyecto';end if;
 else
  if new.project_id is null or not exists(select 1 from public.records where id=new.project_id and workspace_id=new.workspace_id and kind='project') then
   raise exception 'Selecciona un proyecto válido';
  end if;
 end if;
 expected:=case new.kind when 'goal' then 'north_star' when 'opportunity' then 'goal' when 'idea' then 'opportunity' when 'experiment' then 'idea' when 'learning' then 'experiment' when 'kr' then 'objective' else null end;
 if expected is not null then
  if new.parent_id is null and new.kind in ('experiment','learning') then null;
  else
   select kind,project_id into pk,parent_project from public.records where id=new.parent_id and workspace_id=new.workspace_id;
   if (new.kind='goal' and (pk is null or pk not in ('north_star','goal'))) or (new.kind<>'goal' and pk is distinct from expected) or parent_project is distinct from new.project_id then
    raise exception 'El padre debe pertenecer al mismo proyecto y tener el tipo correcto';
   end if;
   if exists(with recursive chain as (
    select id,parent_id from public.records where id=new.parent_id and workspace_id=new.workspace_id
    union select r.id,r.parent_id from public.records r join chain c on r.id=c.parent_id where r.workspace_id=new.workspace_id
   ) select 1 from chain where id=new.id) then raise exception 'El árbol no puede tener ciclos';end if;
  end if;
 elsif new.parent_id is not null then raise exception 'Este tipo debe ser raíz';end if;
 if new.related_id is not null then
  select kind,project_id into pk,parent_project from public.records where id=new.related_id and workspace_id=new.workspace_id;
  if new.kind<>'kr' or pk is distinct from 'goal' or parent_project is distinct from new.project_id then raise exception 'Vinculación Goal inválida';end if;
 end if;
 if new.kind='experiment' then
  if jsonb_typeof(new.fields)<>'object' then raise exception 'Ficha de experimento inválida';end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into new.fields from jsonb_each(new.fields)
   where key=any(array['context','hypothesis','metric','success_criteria','secondary_metrics','audience','traffic_plan','risks','start','impact','confidence','ease','tags','posthog_experiment_id','channel','execution_config']);
  if coalesce(new.fields->>'channel','')<>'' and new.fields->>'channel' not in ('web_app','mobile_ios','mobile_android','app_store','google_play','meta_ads','google_ads','metricool','smartlead','linkedin_ads','tiktok_ads','other') then raise exception 'Canal inválido';end if;
  if new.fields ? 'execution_config' then
   if jsonb_typeof(new.fields->'execution_config')<>'string' or length(new.fields->>'execution_config')>25000 or jsonb_typeof((new.fields->>'execution_config')::jsonb)<>'object' then raise exception 'Configuración inválida';end if;
  end if;
  if coalesce(new.fields->>'start','')<>'' then perform (new.fields->>'start')::date;end if;
 end if;
 foreach k in array array['impact','confidence','ease'] loop
  if new.fields ? k and coalesce(((new.fields->>k)::numeric not between 1 and 10 or (new.fields->>k)::numeric<>trunc((new.fields->>k)::numeric)),true) then raise exception 'ICE debe estar entre 1 y 10';end if;
 end loop;
 if coalesce(new.fields->>'start','')<>'' and coalesce(new.fields->>'end','')<>'' and (new.fields->>'end')::date<(new.fields->>'start')::date then raise exception 'Fechas inválidas';end if;
 if new.kind='opportunity' and (new.fields->>'focus')::boolean=true then
  perform 1 from public.records where id=new.project_id for update;
  if (select count(*) from public.records where project_id=new.project_id and kind='opportunity' and id<>new.id and (fields->>'focus')::boolean=true)>=5 then raise exception 'Selecciona un máximo de 5 oportunidades prioritarias por proyecto';end if;
 end if;
 if tg_op='INSERT' then
  new.created_by:=auth.uid();new.created_by_name:=(select name from public.profiles where id=auth.uid());new.created_at:=now();
 else new.created_by:=old.created_by;new.created_by_name:=old.created_by_name;new.created_at:=old.created_at;end if;
 new.updated_by_name:=(select name from public.profiles where id=auth.uid());new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;


alter table public.record_attachments drop constraint record_attachments_kind_check;
alter table public.record_attachments add constraint record_attachments_kind_check check(kind in ('image','video','pdf','docx','link'));
alter table public.record_attachments drop constraint record_attachments_check;
alter table public.record_attachments add constraint record_attachments_check check(
 (kind='link' and storage_path is null and url ~ '^https?://[^[:space:]]+$' and length(url)<=2000 and size is null and mime_type is null)
 or (kind<>'link' and url is null and storage_path is not null and size between 1 and 10485760 and (
  (kind='image' and mime_type in ('image/jpeg','image/png','image/webp','image/gif')) or
  (kind='video' and mime_type in ('video/mp4','video/webm')) or
  (kind='pdf' and mime_type='application/pdf') or
  (kind='docx' and mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'))));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'] where id='record-attachments';

-- Invoker: record, budget and variants are committed together under existing RLS.
create function public.save_experiment_preparation(p_record jsonb,p_expected timestamptz default null)
returns setof public.records language plpgsql security invoker set search_path='' as $$
declare saved public.records; previous_fields jsonb; plan jsonb; variant jsonb; total_allocation numeric;begin
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
revoke all on function public.save_experiment_preparation(jsonb,timestamptz) from public,anon;
grant execute on function public.save_experiment_preparation(jsonb,timestamptz) to authenticated;
commit;
