-- Flujo de invitación público + onboarding directo al equipo.
-- Ejecutar después de 006_public_preview_and_teams.sql.
begin;

create or replace function experimental_private.invitation_preview(invite_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'team_name', w.name,
    'role', i.role,
    'expires_at', i.expires_at
  )
  from public.invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = invite_token
    and i.used_by is null
    and i.expires_at > now()
  limit 1
$$;

create or replace function public.get_invitation_preview(invite_token uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select experimental_private.invitation_preview(invite_token) $$;

revoke all on function experimental_private.invitation_preview(uuid)
  from public, anon, authenticated;
grant execute on function experimental_private.invitation_preview(uuid)
  to anon, authenticated;

revoke all on function public.get_invitation_preview(uuid)
  from public, anon, authenticated;
grant execute on function public.get_invitation_preview(uuid)
  to anon, authenticated;

create or replace function experimental_private.open_team_space()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w uuid;
  person_name text;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para acceder a tu equipo';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('experimental-team:' || auth.uid()::text, 0));

  select m.workspace_id into w
  from public.members m
  join public.workspaces s on s.id=m.workspace_id
  where m.user_id=auth.uid()
  order by (s.created_by=auth.uid()) desc,s.created_at,s.id
  limit 1;

  if w is not null then return w; end if;

  select name into person_name from public.profiles where id=auth.uid();
  return experimental_private.create_team(
    left('Equipo de experimentación de ' || coalesce(nullif(trim(person_name),''),'Miembro'),120)
  );
end
$$;

notify pgrst, 'reload schema';
commit;
