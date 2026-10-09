-- Preserve existing spaces and memberships. New accounts require an invitation.
-- Attachments, including links, are private to authenticated team members.
begin;

create or replace function experimental_private.open_team_space()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.workspace_id
  from public.members m join public.workspaces w on w.id=m.workspace_id
  where m.user_id=auth.uid()
  order by (w.created_by=auth.uid()) desc,w.created_at,w.id
  limit 1
$$;

revoke all on function public.create_team(text), experimental_private.create_team(text)
  from public, anon, authenticated;

create or replace function experimental_private.read_public_preview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare w uuid;
begin
  if auth.uid() is not null then return null; end if;
  select workspace_id into w from experimental_private.public_preview where singleton and enabled;
  if w is null then return null; end if;
  return jsonb_build_object(
    'workspace',(select jsonb_build_object('id',id,'name',name) from public.workspaces where id=w),
    'records',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.id) from public.records r where r.workspace_id=w),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'name',p.name,'avatar_url',p.avatar_url) order by p.name,m.user_id) from public.members m join public.profiles p on p.id=m.user_id where m.workspace_id=w),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc,a.id) from (select id,actor_id,actor_name,action,record_id,title,created_at from public.audit_log where workspace_id=w order by created_at desc,id limit 100) a),'[]'::jsonb),
    'attachments','[]'::jsonb
  );
end $$;

drop policy if exists os_public_preview_files on storage.objects;
revoke all on function experimental_private.can_read_public_attachment(text) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
