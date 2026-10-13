begin;
-- Verification is a read of the provider, not a change of its credentials/config.
-- Keep approval fingerprints valid across checks; enable/disable still invalidates them.
create function experimental_private.set_integration_state(p_id uuid,p_expected timestamptz,p_enabled boolean,p_note text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections;begin
 select * into r from public.integration_connections where id=p_id for update;
 if auth.uid() is null or r.id is null or public.member_role(r.workspace_id) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 if r.updated_at is distinct from p_expected then raise exception 'La configuración ha cambiado. Actualiza antes de continuar';end if;
 if p_enabled is null then raise exception 'Selecciona un estado válido';end if;
 update public.integration_connections set enabled=p_enabled,
   verified_at=case when p_note is not null then clock_timestamp() else null end,
   verification_note=coalesce(p_note,''),
   updated_at=case when r.enabled is distinct from p_enabled then clock_timestamp() else r.updated_at end,
   updated_by=case when r.enabled is distinct from p_enabled then auth.uid() else r.updated_by end
 where id=p_id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(r.workspace_id,auth.uid(),'integration',case when p_enabled then 'Integración revisada: ' else 'Integración desactivada: ' end||r.provider);
end $$;
create or replace function public.set_integration_state(p_id uuid,p_expected timestamptz,p_enabled boolean,p_note text default null) returns void
language sql security invoker set search_path='' as $$ select experimental_private.set_integration_state(p_id,p_expected,p_enabled,p_note) $$;
revoke all on function experimental_private.set_integration_state(uuid,timestamptz,boolean,text),public.set_integration_state(uuid,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function experimental_private.set_integration_state(uuid,timestamptz,boolean,text),public.set_integration_state(uuid,timestamptz,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
