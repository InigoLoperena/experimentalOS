-- Merge legacy Growth Tree Ideas into the existing shared Hypothesis kind.
-- Preserve every record ID, owner, project, parent link, field, attachment and comment.
begin;
lock table public.records in share row exclusive mode;

-- Retain a private, queryable snapshot for recovery and migration audit.
create table if not exists experimental_private.idea_hypothesis_legacy_backup_20261022 (
  id uuid primary key,
  original_row jsonb not null,
  captured_at timestamptz not null default now()
);
insert into experimental_private.idea_hypothesis_legacy_backup_20261022(id,original_row)
select id,to_jsonb(r) from public.records r where r.kind='idea'
on conflict (id) do nothing;

do $check$
begin
  if exists(
    select 1 from public.records e
    where e.kind='experiment' and e.parent_id is not null
      and coalesce(e.fields->>'mvp_hypothesis_id','')<>''
      and e.parent_id::text<>(e.fields->>'mvp_hypothesis_id')
  ) then
    raise exception 'An experiment has conflicting Growth/MVP hypothesis links; resolve before migration';
  end if;
end $check$;

-- The existing immutable-kind trigger disallows one-time idea -> hypothesis
-- conversion. Disable only that trigger within the locked transaction.
alter table public.records disable trigger record_validation;
update public.records set kind='hypothesis' where kind='idea';
alter table public.records enable trigger record_validation;

-- New experiments are children of hypotheses (the same kind in both trees).
-- Keep every other validation, role check and identity restriction unchanged.
do $function$
declare definition text:=pg_get_functiondef('public.validate_record()'::regprocedure);
begin
  if position('when ''experiment'' then ''hypothesis''' in definition)=0 then
    if position('when ''experiment'' then ''idea''' in definition)=0 then
      raise exception 'Unexpected record validation function: review before migration';
    end if;
    execute replace(definition,'when ''experiment'' then ''idea''',
      'when ''experiment'' then ''hypothesis''');
  end if;
end $function$;

-- parent_id is the canonical shared hypothesis association.
-- fields.mvp_hypothesis_id remains a compatibility mirror for existing
-- integrations, with changes from either editor propagated bidirectionally.
create or replace function public.validate_mvp_record_links()
returns trigger language plpgsql security definer set search_path=public
as $trigger$
declare
  target uuid;
  target_id text;
  old_link text;
  new_link text;
  old_parent uuid;
  parent_changed boolean;
  link_changed boolean;
begin
  if new.kind='experiment' then
    new_link:=nullif(new.fields->>'mvp_hypothesis_id','');
    if tg_op='UPDATE' then
      old_link:=nullif(old.fields->>'mvp_hypothesis_id','');
      old_parent:=old.parent_id;
      parent_changed:=new.parent_id is distinct from old_parent;
      link_changed:=new_link is distinct from old_link;
      if parent_changed and link_changed and
         new.parent_id::text is distinct from new_link then
        raise exception 'El experimento no puede tener dos hipótesis diferentes';
      end if;
      if parent_changed then target:=new.parent_id;
      elsif link_changed then target:=new_link::uuid;
      else target:=coalesce(new.parent_id,new_link::uuid);
      end if;
    else
      if new.parent_id is not null and new_link is not null and new.parent_id::text<>new_link then
        raise exception 'El experimento no puede tener dos hipótesis diferentes';
      end if;
      target:=coalesce(new.parent_id,new_link::uuid);
    end if;
    if target is not null and not exists (
      select 1 from public.records r where r.id=target
       and r.workspace_id=new.workspace_id and r.project_id=new.project_id and r.kind='hypothesis'
    ) then
      raise exception 'La hipótesis debe pertenecer al mismo proyecto';
    end if;
    new.parent_id:=target;
    if target is null then
      new.fields:=new.fields-'mvp_hypothesis_id';
    else
      new.fields:=jsonb_set(new.fields,'{mvp_hypothesis_id}',to_jsonb(target::text),true);
    end if;
  end if;

  if new.kind='research' and coalesce(new.fields->>'mvp_links','')<>'' then
    if length(new.fields->>'mvp_links')>8000 then
      raise exception 'Demasiados vínculos';
    end if;
    for target_id in select trim(unnest(string_to_array(new.fields->>'mvp_links',','))) loop
      if target_id='' or not exists (
        select 1 from public.records r where r.id=target_id::uuid
         and r.workspace_id=new.workspace_id and r.project_id=new.project_id
         and r.kind in ('hypothesis','opportunity')
      ) then
        raise exception 'Las investigaciones solo pueden vincularse a problemas o hipótesis del mismo proyecto';
      end if;
    end loop;
  end if;
  return new;
end $trigger$;

-- Bring pre-existing experiments from both systems into one shared hierarchy.
update public.records set
  parent_id=coalesce(parent_id,nullif(fields->>'mvp_hypothesis_id','')::uuid),
  fields=case
    when coalesce(parent_id,nullif(fields->>'mvp_hypothesis_id','')::uuid) is null
      then fields-'mvp_hypothesis_id'
    else jsonb_set(fields,'{mvp_hypothesis_id}',
      to_jsonb(coalesce(parent_id,nullif(fields->>'mvp_hypothesis_id','')::uuid)::text),true)
  end
where kind='experiment'
  and (parent_id is not null or coalesce(fields->>'mvp_hypothesis_id','')<>'');

-- Prevent new physical Idea records; historical ones have already become
-- hypotheses using their original IDs.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check
 check(kind in ('north_star','goal','opportunity','hypothesis','research',
               'experiment','learning','objective','kr','project'));

do $verify$
begin
  if exists(select 1 from public.records where kind='idea') then
    raise exception 'Idea records remain after migration';
  end if;
  if exists(
   select 1 from public.records e
   where e.kind='experiment' and (
     e.parent_id::text is distinct from nullif(e.fields->>'mvp_hypothesis_id','')
   )
  ) then raise exception 'Experiment hypothesis parent/link mismatch'; end if;
  if exists(
   select 1 from experimental_private.idea_hypothesis_legacy_backup_20261022 b
   left join public.records r on r.id=b.id
   where r.id is null or r.kind<>'hypothesis'
      or r.title is distinct from b.original_row->>'title'
      or r.project_id::text is distinct from b.original_row->>'project_id'
      or r.fields is distinct from b.original_row->'fields'
  ) then raise exception 'Idea record identity, content, or project was not preserved'; end if;
end $verify$;

notify pgrst,'reload schema';
commit;
