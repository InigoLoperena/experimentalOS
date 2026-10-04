-- Ejecutar después de las migraciones 001 a 004. Conserva los datos y las cuentas.
begin;

-- Una referencia privada al único equipo de esta instalación.
create table if not exists public.internal_team (
  singleton boolean primary key default true check (singleton),
  workspace_id uuid not null unique references public.workspaces(id) on delete restrict
);
alter table public.internal_team enable row level security;
revoke all on public.internal_team from public, anon, authenticated;

-- Reutiliza el primer espacio existente, sin cambiar sus miembros ni registros.
insert into public.internal_team(singleton, workspace_id)
select true, id from public.workspaces order by created_at, id limit 1
on conflict (singleton) do nothing;

create or replace function public.open_internal_space() returns uuid
language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para acceder al equipo'; end if;
  -- Serializa el primer acceso: nunca se crean dos equipos al mismo tiempo.
  perform pg_advisory_xact_lock(782631005);
  select workspace_id into w from public.internal_team where singleton;
  if w is null then
    insert into public.workspaces(name, created_by) values('Imagine Builder', auth.uid()) returning id into w;
    insert into public.members(workspace_id, user_id, role) values(w, auth.uid(), 'owner');
    insert into public.internal_team(singleton, workspace_id) values(true, w);
  end if;
  if public.is_member(w) then return w; end if;
  -- Crear una cuenta no da acceso a los datos sin invitación del administrador.
  return null;
end $$;

create or replace function public.join_workspace(invite_token uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invitations;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para aceptar la invitación'; end if;
  select i.* into inv from public.invitations i
    join public.internal_team t on t.workspace_id=i.workspace_id
    where i.token=invite_token and i.used_by is null and i.expires_at>now() for update of i;
  if not found then raise exception 'Invitación inválida, usada o caducada'; end if;
  insert into public.members(workspace_id, user_id, role) values(inv.workspace_id, auth.uid(), inv.role) on conflict do nothing;
  update public.invitations set used_by=auth.uid() where id=inv.id;
  insert into public.audit_log(workspace_id, actor_id, action, title) values(inv.workspace_id, auth.uid(), 'join', 'Nuevo miembro');
  return inv.workspace_id;
end $$;

-- Se retiran las operaciones de perfiles de empresa también de la API pública.
revoke all on function public.create_workspace(text), public.update_workspace_profile(uuid,text,text,text), public.delete_workspace(uuid,text) from public, anon, authenticated;
revoke all on function public.open_internal_space(), public.join_workspace(uuid) from public, anon;
grant execute on function public.open_internal_space(), public.join_workspace(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
