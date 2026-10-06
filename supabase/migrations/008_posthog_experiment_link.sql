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
   where key=any(array['context','hypothesis','metric','success_criteria','secondary_metrics','audience','traffic_plan','risks','start','impact','confidence','ease','tags','posthog_experiment_id']);
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
