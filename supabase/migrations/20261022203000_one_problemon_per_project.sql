-- One project-scoped shared principal problem/opportunity (no new kind and no data rewrite).
begin;
create unique index if not exists one_problemon_per_project
 on public.records(project_id)
 where kind='opportunity' and (fields->>'is_problemon')='true' and project_id is not null;
comment on index public.one_problemon_per_project is
 'One shared Problemon opportunity per project in Growth Tree and MVPs Tree';
notify pgrst,'reload schema';
commit;
