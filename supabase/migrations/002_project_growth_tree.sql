-- Existing projects: execute ONLY this file in Supabase SQL Editor.
-- Fresh projects: execute 001_initial.sql first, then this file.
-- Keeps records and audit history; copies legacy experiment learnings into
-- separate learning records. Old experiment fields are cleaned on the next edit.
begin;

alter table public.records add column if not exists project_id uuid;
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check
  check (kind in ('north_star','goal','opportunity','idea','experiment','learning','objective','kr','project'));

-- Give existing data one consistent project without breaking its tree links.
-- Use the first existing project, or create 'Proyecto inicial' when none exists.
insert into public.records(workspace_id,kind,title,fields)
select w.id,'project','Proyecto inicial','{"description":"Datos anteriores a la organización por proyectos."}'::jsonb
from public.workspaces w
where exists(select 1 from public.records r where r.workspace_id=w.id and r.kind<>'project')
and not exists(select 1 from public.records p where p.workspace_id=w.id and p.kind='project');

update public.records r set project_id=(
  select p.id from public.records p where p.workspace_id=r.workspace_id and p.kind='project'
  order by p.created_at,p.id limit 1
) where r.kind<>'project' and r.project_id is null;
update public.records set related_id=null where kind='project' and related_id is not null;

do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.records'::regclass and conname='records_project_fk') then
  alter table public.records add constraint records_project_fk
    foreign key(project_id,workspace_id) references public.records(id,workspace_id);
 end if;
end $$;
drop index if exists public.one_north_star;
create unique index if not exists one_north_star_per_project on public.records(project_id) where kind='north_star';
create index if not exists records_project on public.records(workspace_id,project_id);

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
   where key=any(array['context','hypothesis','metric','success_criteria','secondary_metrics','audience','traffic_plan','risks','start','impact','confidence','ease','tags']);
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

-- Removed project/KR links must not prevent deleting unrelated records.
-- Normal parent/project foreign keys still protect records with children.
drop trigger if exists record_delete_guard on public.records;
drop function if exists public.guard_record_delete();
create or replace function public.remove_member(w uuid, member_id uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el propietario puede retirar el acceso';end if;
 if not exists(select 1 from public.members where workspace_id=w and user_id=member_id and role<>'owner') then raise exception 'Miembro inexistente o propietario';end if;
 update public.records set owner_id=null where workspace_id=w and owner_id=member_id;
 delete from public.members where workspace_id=w and user_id=member_id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'remove_member','Acceso retirado a un miembro');
end $$;
revoke all on function public.validate_record() from public;
revoke all on function public.remove_member(uuid,uuid) from public;
grant execute on function public.remove_member(uuid,uuid) to authenticated;

insert into public.records(workspace_id,project_id,kind,title,parent_id,owner_id,fields)
select e.workspace_id,e.project_id,'learning','Aprendizaje: '||e.title,e.id,e.owner_id,
 jsonb_build_object('context',coalesce(e.fields->>'context',''),
 'result',coalesce(e.fields->>'result',''),
 'learning',concat_ws(E'\n\n',nullif(e.fields->>'learning',''),nullif(e.fields->>'conclusion','')),
 'decision',coalesce(e.fields->>'decision',''),'next_steps',coalesce(e.fields->>'next_steps',''),
 'evidence',coalesce(e.fields->>'source_url',''),'tags',coalesce(e.fields->>'tags',''))
from public.records e where e.kind='experiment'
 and (coalesce(e.fields->>'result','')<>'' or coalesce(e.fields->>'learning','')<>'' or coalesce(e.fields->>'conclusion','')<>'')
 and not exists(select 1 from public.records l where l.kind='learning' and l.parent_id=e.id);
commit;
