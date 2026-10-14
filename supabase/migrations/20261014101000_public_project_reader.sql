-- Public reader access to project work, with a strict field allowlist and no private team data.
-- Do not publish API configuration, identities, attachments, AI memory, or comments.
begin;

create or replace function experimental_private.read_public_preview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare featured_workspace uuid;
begin
  if auth.uid() is not null then return null; end if;
  select p.workspace_id into featured_workspace
  from experimental_private.public_preview p
  join public.workspaces w on w.id=p.workspace_id
  where p.singleton and p.enabled
    and exists(select 1 from public.members m
      where m.workspace_id=w.id and m.user_id=w.created_by and m.role='owner');
  if featured_workspace is null then return null; end if;

  return jsonb_build_object(
    'workspace',(select jsonb_build_object('id',w.id,'name',w.name)
      from public.workspaces w where w.id=featured_workspace),
    'records',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',r.id,
          'workspace_id',r.workspace_id,
          'project_id',r.project_id,
          'kind',r.kind,
          'parent_id',r.parent_id,
          'related_id',r.related_id,
          'title',r.title,
          'owner_id',null,
          'fields',coalesce((
            select jsonb_object_agg(allowed.key,r.fields->allowed.key)
            from unnest(array[
              'description','site_url','north_star',
              'goi_section','metric','definition','value_moment','frequency',
              'unit','current','baseline','target','period','metric_status','source',
              'focus','evidence','experimental_focus',
              'impact','confidence','ease','demo_data',
              'context','hypothesis','success_criteria','secondary_metrics',
              'audience','traffic_plan','risks','tags','start','end',
              'method','variants','status','result','conclusion','learning','decision',
              'channel'
            ]::text[]) as allowed(key)
            where r.fields ? allowed.key
          ),'{}'::jsonb),
          'created_at',r.created_at,
          'updated_at',r.updated_at,
          'created_by',null,
          'updated_by',null
        )
        order by r.created_at,r.id
      )
      from public.records r
      where r.workspace_id=featured_workspace
        and r.kind in ('project','north_star','goal','opportunity','idea','experiment','learning','objective','kr')
    ),'[]'::jsonb),
    'members','[]'::jsonb,
    'activity','[]'::jsonb,
    'attachments','[]'::jsonb
  );
end
$function$;

revoke all on function experimental_private.read_public_preview() from public,anon,authenticated;
revoke all on function public.get_public_preview() from public,anon,authenticated;
grant execute on function experimental_private.read_public_preview() to anon;
grant execute on function public.get_public_preview() to anon;
notify pgrst, 'reload schema';
commit;
