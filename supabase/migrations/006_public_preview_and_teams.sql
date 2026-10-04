-- Vista pública del equipo original + espacios privados independientes para usuarios registrados.
-- Ejecutar después de 005_internal_team.sql.
begin;

create schema if not exists experimental_private;
grant usage on schema experimental_private to anon, authenticated;

create table if not exists experimental_private.public_preview (
  singleton boolean primary key default true check (singleton),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  enabled boolean not null default true
);
alter table experimental_private.public_preview enable row level security;
revoke all on experimental_private.public_preview from public, anon, authenticated;

insert into experimental_private.public_preview(singleton, workspace_id, enabled)
select true, id, true from public.workspaces order by created_at, id limit 1
on conflict (singleton) do nothing;

create or replace function experimental_private.create_team(team_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para crear tu equipo'; end if;
  if team_name is null or length(trim(team_name)) not between 1 and 120 then raise exception 'El nombre del equipo debe tener entre 1 y 120 caracteres'; end if;
  perform pg_advisory_xact_lock(hashtextextended('experimental-team:' || auth.uid()::text, 0));
  insert into public.workspaces(name, created_by) values(trim(team_name), auth.uid()) returning id into w;
  insert into public.members(workspace_id, user_id, role) values(w, auth.uid(), 'owner');
  return w;
end $$;

create or replace function experimental_private.open_team_space() returns uuid
language plpgsql security definer set search_path = '' as $$
declare w uuid; person_name text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para acceder a tu equipo'; end if;
  perform pg_advisory_xact_lock(hashtextextended('experimental-team:' || auth.uid()::text, 0));
  select m.workspace_id into w from public.members m join public.workspaces s on s.id=m.workspace_id
  where m.user_id=auth.uid() order by (s.created_by=auth.uid()) desc,s.created_at,s.id limit 1;
  if w is not null then return w; end if;
  select name into person_name from public.profiles where id=auth.uid();
  return experimental_private.create_team('Equipo de ' || left(coalesce(nullif(trim(person_name),''),'Miembro'),100));
end $$;

create or replace function experimental_private.join_team(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invitations;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para aceptar la invitación'; end if;
  select * into inv from public.invitations i where i.token=invite_token and i.used_by is null and i.expires_at>now() for update;
  if not found then raise exception 'Invitación inválida, usada o caducada'; end if;
  insert into public.members(workspace_id,user_id,role) values(inv.workspace_id,auth.uid(),inv.role) on conflict do nothing;
  update public.invitations set used_by=auth.uid() where id=inv.id;
  insert into public.audit_log(workspace_id,actor_id,action,title) values(inv.workspace_id,auth.uid(),'join','Nuevo miembro');
  return inv.workspace_id;
end $$;

create or replace function experimental_private.read_public_preview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
    'attachments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id) from public.record_attachments a join public.records r on r.id=a.record_id and r.workspace_id=a.workspace_id where a.workspace_id=w),'[]'::jsonb)
  );
end $$;

create or replace function experimental_private.can_read_public_attachment(object_path text) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is null and exists(select 1 from experimental_private.public_preview p
 join public.record_attachments a on a.workspace_id=p.workspace_id
 join public.records r on r.id=a.record_id and r.workspace_id=a.workspace_id
 where p.singleton and p.enabled and a.kind<>'link' and a.storage_path=object_path);
$$;

create or replace function experimental_private.rename_team(w uuid, team_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or public.member_role(w) is distinct from 'owner' then raise exception 'Solo el administrador puede editar el equipo'; end if;
 if team_name is null or length(trim(team_name)) not between 1 and 120 then raise exception 'El nombre del equipo debe tener entre 1 y 120 caracteres'; end if;
 update public.workspaces set name=trim(team_name) where id=w;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'team_name','Nombre del equipo actualizado');
end $$;

create or replace function experimental_private.public_status(w uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare featured uuid; active boolean;
begin
 if auth.uid() is null or not public.is_member(w) then raise exception 'No tienes acceso a este equipo'; end if;
 select workspace_id,enabled into featured,active from experimental_private.public_preview where singleton;
 if featured is null then select id into featured from public.workspaces order by created_at,id limit 1; end if;
 return jsonb_build_object('eligible',featured=w,'enabled',featured=w and coalesce(active,false));
end $$;

create or replace function experimental_private.set_public_preview(w uuid, is_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare featured uuid;
begin
 if auth.uid() is null or public.member_role(w) is distinct from 'owner' then raise exception 'Solo el administrador puede gestionar la vista pública'; end if;
 perform pg_advisory_xact_lock(782631006);
 select workspace_id into featured from experimental_private.public_preview where singleton;
 if featured is null then select id into featured from public.workspaces order by created_at,id limit 1; end if;
 if featured is distinct from w then raise exception 'Este equipo es privado y no puede sustituir al equipo de la vista pública'; end if;
 if is_enabled is null then raise exception 'Indica si la vista pública está activada'; end if;
 insert into experimental_private.public_preview(singleton,workspace_id,enabled) values(true,w,is_enabled)
 on conflict(singleton) do update set enabled=excluded.enabled;
end $$;

create or replace function public.create_team(team_name text) returns uuid language sql set search_path = '' as $$ select experimental_private.create_team(team_name) $$;
create or replace function public.open_team_space() returns uuid language sql set search_path = '' as $$ select experimental_private.open_team_space() $$;
create or replace function public.join_workspace(invite_token uuid) returns uuid language sql set search_path = '' as $$ select experimental_private.join_team(invite_token) $$;
create or replace function public.get_public_preview() returns jsonb language sql stable set search_path = '' as $$ select experimental_private.read_public_preview() $$;
create or replace function public.rename_team(w uuid, team_name text) returns void language sql set search_path = '' as $$ select experimental_private.rename_team(w,team_name) $$;
create or replace function public.get_team_public_status(w uuid) returns jsonb language sql stable set search_path = '' as $$ select experimental_private.public_status(w) $$;
create or replace function public.set_team_public_preview(w uuid, is_enabled boolean) returns void language sql set search_path = '' as $$ select experimental_private.set_public_preview(w,is_enabled) $$;

revoke all on function public.create_team(text), public.open_team_space(), public.join_workspace(uuid), public.get_public_preview(), public.rename_team(uuid,text), public.get_team_public_status(uuid), public.set_team_public_preview(uuid,boolean) from public, anon, authenticated;
grant execute on function public.get_public_preview() to anon;
grant execute on function public.create_team(text), public.open_team_space(), public.join_workspace(uuid), public.rename_team(uuid,text), public.get_team_public_status(uuid), public.set_team_public_preview(uuid,boolean) to authenticated;

revoke all on function experimental_private.create_team(text), experimental_private.open_team_space(), experimental_private.join_team(uuid), experimental_private.read_public_preview(), experimental_private.can_read_public_attachment(text), experimental_private.rename_team(uuid,text), experimental_private.public_status(uuid), experimental_private.set_public_preview(uuid,boolean) from public, anon, authenticated;
grant execute on function experimental_private.read_public_preview(), experimental_private.can_read_public_attachment(text) to anon;
grant execute on function experimental_private.create_team(text), experimental_private.open_team_space(), experimental_private.join_team(uuid), experimental_private.rename_team(uuid,text), experimental_private.public_status(uuid), experimental_private.set_public_preview(uuid,boolean) to authenticated;

drop policy if exists os_public_preview_files on storage.objects;
create policy os_public_preview_files on storage.objects for select to anon
using (bucket_id='record-attachments' and experimental_private.can_read_public_attachment(name));

drop function if exists public.open_internal_space();
drop table if exists public.internal_team;

notify pgrst, 'reload schema';
commit;
