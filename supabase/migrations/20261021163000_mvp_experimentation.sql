-- MVPs Experimentation lives beside GOI Tree. Problems and experiments keep their
-- existing record IDs; only Hypotheses and Research are new record kinds.
begin;

alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check check
 (kind in ('north_star','goal','opportunity','idea','experiment','learning',
           'objective','kr','project','hypothesis','research'));

-- Extend the existing record validator rather than replacing its project,
-- audit, experiment, ownership and cycle safeguards.
do $mvp$
declare definition text := pg_get_functiondef('public.validate_record()'::regprocedure);
begin
  if position('when ''hypothesis'' then ''opportunity''' in definition)=0 then
    if position('when ''experiment'' then ''idea''' in definition)=0
      then raise exception 'Unexpected validator parent rules'; end if;
    definition := replace(definition, 'when ''experiment'' then ''idea''',
      'when ''experiment'' then ''idea'' when ''hypothesis'' then ''opportunity''');
  end if;
  if position('''kr'',''hypothesis'') then null' in definition)=0 then
    if position('''kr'') then null' in definition)=0
      then raise exception 'Unexpected validator orphan rules'; end if;
    definition := replace(definition,
      '''experiment'',''learning'',''opportunity'',''idea'',''kr'') then null',
      '''experiment'',''learning'',''opportunity'',''idea'',''kr'',''hypothesis'') then null');
  end if;
  if position('''mvp_hypothesis_id''' in definition)=0 then
    if position('''channel'',''execution_config''' in definition)=0
      then raise exception 'Unexpected experiment field allowlist'; end if;
    definition := replace(definition, '''channel'',''execution_config''',
      '''channel'',''execution_config'',''description'',''end'',''result'',''learning'',''decision'',''mvp_hypothesis_id''');
  end if;
  execute definition;
end $mvp$;

-- Additional links keep GOI's parent_id unchanged. Research supports
-- multiple targets through comma-separated UUIDs stored in fields.mvp_links.
create or replace function public.validate_mvp_record_links()
returns trigger language plpgsql security definer set search_path=public
as $mvp$
declare target uuid; target_id text;
begin
  if new.kind='experiment' and coalesce(new.fields->>'mvp_hypothesis_id','')<>'' then
    target := (new.fields->>'mvp_hypothesis_id')::uuid;
    if not exists (
      select 1 from public.records r where r.id=target
      and r.workspace_id=new.workspace_id and r.project_id=new.project_id
      and r.kind='hypothesis'
    ) then raise exception 'La hipótesis debe pertenecer al mismo proyecto'; end if;
  end if;
  if new.kind='research' and coalesce(new.fields->>'mvp_links','')<>'' then
    if length(new.fields->>'mvp_links')>8000 then raise exception 'Demasiados vínculos';end if;
    for target_id in select trim(unnest(string_to_array(new.fields->>'mvp_links',','))) loop
      if target_id='' or not exists (
        select 1 from public.records r where r.id=target_id::uuid
        and r.workspace_id=new.workspace_id and r.project_id=new.project_id
        and r.kind in ('hypothesis','opportunity')
      ) then raise exception 'Las investigaciones solo pueden vincularse a problemas o hipótesis del mismo proyecto';end if;
    end loop;
  end if;
  return new;
end $mvp$;
drop trigger if exists zz_mvp_record_links on public.records;
create trigger zz_mvp_record_links before insert or update on public.records
for each row execute function public.validate_mvp_record_links();
revoke all on function public.validate_mvp_record_links() from public;

-- Unlink without deleting children when a problem/hypothesis is deleted.
create or replace function public.cleanup_mvp_record_links()
returns trigger language plpgsql security definer set search_path=public
as $mvp$
begin
  if old.kind='hypothesis' then
    update public.records set fields=fields-'mvp_hypothesis_id'
    where workspace_id=old.workspace_id and project_id=old.project_id
      and kind='experiment' and fields->>'mvp_hypothesis_id'=old.id::text;
  end if;
  if old.kind in ('opportunity','hypothesis') then
    update public.records
      set fields=jsonb_set(fields,'{mvp_links}',
        to_jsonb(array_to_string(array_remove(
          string_to_array(fields->>'mvp_links',','),old.id::text),',')),true)
    where workspace_id=old.workspace_id and project_id=old.project_id
      and kind='research' and old.id::text=any(string_to_array(fields->>'mvp_links',','));
  end if;
  return old;
end $mvp$;
drop trigger if exists zz_cleanup_mvp_links on public.records;
create trigger zz_cleanup_mvp_links after delete on public.records
for each row execute function public.cleanup_mvp_record_links();
revoke all on function public.cleanup_mvp_record_links() from public;

-- Public visitors receive only explicitly approved non-sensitive fields.
-- The private/authenticated workspace still reads through existing RLS.
do $mvp$
declare definition text := pg_get_functiondef('experimental_private.read_public_preview()'::regprocedure);
begin
  if position('''hypothesis'',''research''' in definition)=0 then
    if position('''objective'',''kr''' in definition)=0 then
      raise exception 'Unexpected public preview record-kind allowlist'; end if;
    definition:=replace(definition,'''objective'',''kr''',
       '''objective'',''kr'',''hypothesis'',''research''');
  end if;
  if position('''mvp_hypothesis_id''' in definition)=0 then
    definition:=replace(definition,'''channel''',
       '''channel'',''mvp_hypothesis_id'',''mvp_links'',''targets'',''value_propositions'',''monetization_channels'',''belief'',''reason'',''validation_need'',''method'',''findings'',''description'',''end'');
  end if;
  execute definition;
end $mvp$;

notify pgrst,'reload schema';
commit;
