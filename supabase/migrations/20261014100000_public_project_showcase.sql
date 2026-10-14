-- Public showcase: only title, description and website of the administrator's projects.
-- This migration never enables an unrelated installation's public preview.
begin;
create or replace function experimental_private.read_public_preview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare featured_workspace uuid;
begin
  if auth.uid() is not null then return null; end if;
  select p.workspace_id into featured_workspace from experimental_private.public_preview p
   join public.workspaces w on w.id=p.workspace_id
   where p.singleton and p.enabled
     and exists(select 1 from public.members m where m.workspace_id=w.id and m.user_id=w.created_by and m.role='owner');
  if featured_workspace is null then return null; end if;
  return jsonb_build_object(
    'workspace',(select jsonb_build_object('id',w.id,'name',w.name) from public.workspaces w where w.id=featured_workspace),
    'records',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'workspace_id',r.workspace_id,'project_id',null,
        'kind','project','parent_id',null,'related_id',null,
        'title',r.title,'owner_id',null,
        'fields',jsonb_build_object(
          'description',coalesce(r.fields->>'description',''),
          'site_url',coalesce(r.fields->>'site_url','')
        ),
        'created_at',r.created_at,'updated_at',r.updated_at,
        'created_by',null,'updated_by',null
      ) order by r.created_at,r.id)
        from public.records r
       where r.workspace_id=featured_workspace and r.kind='project'
    ),'[]'::jsonb),
    'members','[]'::jsonb,'activity','[]'::jsonb,'attachments','[]'::jsonb
  );
end
$function$;
revoke all on function experimental_private.read_public_preview() from public,anon,authenticated;
revoke all on function public.get_public_preview() from public,anon,authenticated;
grant execute on function experimental_private.read_public_preview() to anon;
grant execute on function public.get_public_preview() to anon;
notify pgrst, 'reload schema';
commit;
