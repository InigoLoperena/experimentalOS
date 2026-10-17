-- Deleting a GOI parent must preserve its children as standalone records.
-- A workspace_id / project_id must never change when detaching an association.
begin;

-- The FK on (parent_id, workspace_id) previously used NO ACTION and blocked
-- deleting the objective "b" because the opportunity "c" still referenced it.
-- In PostgreSQL 17, SET NULL (parent_id) preserves the NOT NULL workspace_id.
alter table public.records
  drop constraint if exists records_parent_id_workspace_id_fkey;
alter table public.records
  add constraint records_parent_id_workspace_id_fkey
  foreign key (parent_id,workspace_id) references public.records(id,workspace_id)
  on delete set null (parent_id);

-- Optional related goal references must not independently block deletion.
alter table public.records
  drop constraint if exists records_related_id_workspace_id_fkey;
alter table public.records
  add constraint records_related_id_workspace_id_fkey
  foreign key (related_id,workspace_id) references public.records(id,workspace_id)
  on delete set null (related_id);

-- The existing validation trigger rejects NULL parents for opportunities and
-- ideas on any UPDATE. The FK action updates those children automatically.
-- Preserve every other validation (workspace, project, types, cycles, auditing)
-- and enable only intentionally parentless child kinds.
do $$
declare
  definition text := pg_get_functiondef('public.validate_record()'::regprocedure);
  old_rule constant text := 'if new.parent_id is null and new.kind in (''experiment'',''learning'') then null;';
  new_rule constant text := 'if new.parent_id is null and new.kind in (''experiment'',''learning'',''opportunity'',''idea'',''kr'') then null;';
begin
  if strpos(definition, new_rule) = 0 then
    if strpos(definition, old_rule) = 0 then
      raise exception 'Unexpected validate_record definition: manual review required';
    end if;
    execute replace(definition, old_rule, new_rule);
  end if;
end $$;

-- RLS and record-delete permissions are intentionally unchanged:
-- only a member with delete permission for this record kind may remove it.
notify pgrst,'reload schema';
commit;
