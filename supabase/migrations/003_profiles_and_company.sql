-- Instalaciones existentes: ejecutar después de 002_project_growth_tree.sql.
-- No vuelve a crear cuentas ni borra datos al instalarse.
begin;
alter table public.profiles add column if not exists avatar_url text;
alter table public.workspaces add column if not exists website text;
alter table public.workspaces add column if not exists logo_url text;

-- Las fotos se guardan como imágenes pequeñas; no necesitan configurar Storage.
create or replace function public.valid_profile_image(value text) returns boolean
language sql immutable set search_path = '' as $$
 select value is null or value = '' or (
  length(value) <= 400000 and value ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
 );
$$;
revoke all on function public.valid_profile_image(text) from public;

-- Sin ID de usuario como parámetro: cada persona solo puede editar su perfil.
create or replace function public.update_my_profile(profile_name text, photo text default null) returns void
language plpgsql security definer set search_path = '' as $$ begin
 if auth.uid() is null then raise exception 'Inicia sesión para editar tu perfil';end if;
 if profile_name is null or length(trim(profile_name)) not between 1 and 100 then raise exception 'El nombre debe tener entre 1 y 100 caracteres';end if;
 if not public.valid_profile_image(photo) then raise exception 'Foto inválida o demasiado grande';end if;
 update public.profiles set name=trim(profile_name),avatar_url=nullif(photo,'') where id=auth.uid();
 if not found then raise exception 'No se ha encontrado tu perfil';end if;
end $$;

create or replace function public.update_workspace_profile(w uuid, company_name text, company_website text default null, company_logo text default null) returns void
language plpgsql security definer set search_path = '' as $$ begin
 perform 1 from public.workspaces where id=w for update;
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el administrador puede editar esta empresa';end if;
 if company_name is null or length(trim(company_name)) not between 1 and 120 then raise exception 'El nombre debe tener entre 1 y 120 caracteres';end if;
 if nullif(trim(company_website),'') is not null and (length(company_website)>2000 or company_website !~ '^https?://[^[:space:]]+$') then raise exception 'Introduce una web válida con https:// o http://';end if;
 if not public.valid_profile_image(company_logo) then raise exception 'Logo inválido o demasiado grande';end if;
 update public.workspaces set name=trim(company_name),website=nullif(trim(company_website),''),logo_url=nullif(company_logo,'') where id=w;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'company_profile','Perfil de empresa actualizado');
end $$;

create or replace function public.remove_member(w uuid, member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
 perform 1 from public.workspaces where id=w for update;
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el administrador puede retirar el acceso';end if;
 if not exists(select 1 from public.members where workspace_id=w and user_id=member_id and role<>'owner') then raise exception 'Miembro inexistente o administrador';end if;
 update public.records set owner_id=null where workspace_id=w and owner_id=member_id;
 delete from public.members where workspace_id=w and user_id=member_id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'remove_member','Acceso retirado a un miembro');
end $$;

-- La confirmación y los permisos se comprueban también en la base de datos.
create or replace function public.delete_workspace(w uuid, confirmation_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_name text;begin
 select name into current_name from public.workspaces where id=w for update;
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el administrador puede eliminar esta empresa';end if;
 if confirmation_name is distinct from current_name then raise exception 'Escribe el nombre exacto de la empresa para confirmar';end if;
 -- Se eliminan todos los registros en una sentencia para respetar sus enlaces.
 -- El historial se borra después junto con la empresa; las cuentas se conservan.
 delete from public.records where workspace_id=w;
 delete from public.workspaces where id=w;
end $$;

revoke all on function public.update_my_profile(text,text),public.update_workspace_profile(uuid,text,text,text),public.remove_member(uuid,uuid),public.delete_workspace(uuid,text) from public,anon;
grant execute on function public.update_my_profile(text,text),public.update_workspace_profile(uuid,text,text,text),public.remove_member(uuid,uuid),public.delete_workspace(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
