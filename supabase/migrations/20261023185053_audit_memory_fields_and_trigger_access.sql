-- Include the newer research/hypothesis fields in the private, rebuildable AI
-- index. Source rows, their timestamps, ownership and evidence remain untouched.
begin;

do $audit$
declare
  definition text := pg_get_functiondef('experimental_private.index_ai_source(text,jsonb)'::regprocedure);
  previous_keys text := '''opportunity_type'',''validation''';
  current_keys text := '''opportunity_type'',''validation'',''findings'',''method'',''audience'',''belief'',''reason'',''validation_need'',''targets'',''value_propositions'',''monetization_channels'',''is_problemon'',''is_main_hypothesis''';
  source jsonb;
begin
  if position(current_keys in definition) = 0 then
    if position(previous_keys in definition) = 0 then
      raise exception 'Unexpected AI record allowlist; review before migration';
    end if;
    execute replace(definition, previous_keys, current_keys);
  end if;
  -- Rebuild derived chunks for existing sources too; changing the trigger alone
  -- would only fix records edited after deployment. Other source types stay intact.
  for source in select to_jsonb(r) from public.records r
    where r.kind in ('research','hypothesis','opportunity','project','experiment')
  loop
    perform experimental_private.index_ai_source('records', source);
  end loop;
end $audit$;

-- These return trigger, are invoked by PostgreSQL, and are not client RPCs.
-- Production had explicit role grants in addition to PUBLIC inheritance.
revoke all on function public.validate_mvp_record_links() from public, anon, authenticated;
revoke all on function public.cleanup_mvp_record_links() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
