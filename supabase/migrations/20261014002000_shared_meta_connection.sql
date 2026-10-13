begin;
-- One explicitly chosen Meta connection per team; encrypted credentials keep
-- their original project binding. Other teams and other providers cannot inherit it.
alter table public.integration_connections add column workspace_default boolean not null default false;
alter table public.integration_connections add constraint integration_default_meta_only check(not workspace_default or (provider='meta_ads' and source='encrypted'));
create unique index integration_one_meta_default on public.integration_connections(workspace_id) where workspace_default;

create function experimental_private.set_meta_workspace_default(p_id uuid,p_expected timestamptz,p_shared boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections;begin
 select * into r from public.integration_connections where id=p_id;
 if auth.uid() is null or r.id is null or public.member_role(r.workspace_id) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 perform 1 from public.workspaces where id=r.workspace_id for update;
 select * into r from public.integration_connections where id=p_id for update;
 if r.updated_at is distinct from p_expected then raise exception 'La configuración ha cambiado. Actualiza antes de continuar';end if;
 if p_shared is null or r.provider<>'meta_ads' or r.source<>'encrypted' then raise exception 'Selecciona una conexión privada de Meta';end if;
 if p_shared and not r.enabled then raise exception 'Activa la conexión antes de compartirla';end if;
 if p_shared then
  update public.integration_connections set workspace_default=false,updated_at=clock_timestamp(),updated_by=auth.uid()
   where workspace_id=r.workspace_id and workspace_default and id<>r.id;
 end if;
 update public.integration_connections set workspace_default=p_shared,updated_at=clock_timestamp(),updated_by=auth.uid() where id=r.id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(r.workspace_id,auth.uid(),'integration',case when p_shared then 'Meta compartido entre los proyectos del equipo' else 'Meta limitado a su proyecto' end);
end $$;
revoke all on function experimental_private.set_meta_workspace_default(uuid,timestamptz,boolean) from public,anon;
grant execute on function experimental_private.set_meta_workspace_default(uuid,timestamptz,boolean) to authenticated;
create function public.set_meta_workspace_default(p_id uuid,p_expected timestamptz,p_shared boolean) returns void
language sql security invoker set search_path='' as $$select experimental_private.set_meta_workspace_default(p_id,p_expected,p_shared);$$;
revoke all on function public.set_meta_workspace_default(uuid,timestamptz,boolean) from public,anon;
grant execute on function public.set_meta_workspace_default(uuid,timestamptz,boolean) to authenticated;
commit;
