begin;
-- Share the existing encrypted connection, without moving its ciphertext or
-- changing the project/configuration used as authenticated encryption data.
alter table public.integration_connections drop constraint integration_default_meta_only;
drop index public.integration_one_meta_default;
alter table public.integration_connections drop constraint integration_connections_check;
alter table public.integration_connections add constraint integration_openai_workspace check(provider<>'openai' or project_id is null);
alter table public.integration_connections add constraint integration_default_private check(not workspace_default or source='encrypted');
create unique index integration_one_workspace_default on public.integration_connections(workspace_id,provider) where workspace_default;
alter table public.integration_connections add constraint integration_profile_scope unique(id,workspace_id,provider);
-- Only promote an unambiguous existing private account. Multiple old accounts
-- remain intact and the owner chooses the shared account in Integrations.
update public.integration_connections c set workspace_default=true
where c.source='encrypted' and not c.workspace_default
and not exists(select 1 from public.integration_connections d where d.workspace_id=c.workspace_id and d.provider=c.provider and d.workspace_default)
and 1=(select count(*) from public.integration_connections d where d.workspace_id=c.workspace_id and d.provider=c.provider and d.source='encrypted');

create function experimental_private.save_workspace_integration(p_workspace uuid,p_connection uuid,p_provider text,p_config jsonb,p_fields text[],p_envelope text,p_expected timestamptz default null) returns public.integration_connections
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections; save_expected timestamptz;begin
 if auth.uid() is null or public.member_role(p_workspace) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if p_connection is not null then
  select * into r from public.integration_connections where id=p_connection and workspace_id=p_workspace and provider=p_provider for update;
  if r.id is null then raise exception 'Conexión no autorizada';end if;
  if r.updated_at is distinct from p_expected then raise exception 'La configuración ha cambiado. Actualiza antes de guardar';end if;
  if r.project_id is not null and exists(select 1 from public.integration_connections where workspace_id=p_workspace and provider=p_provider and project_id is null) then raise exception 'La conexión del espacio ya existe. Actualiza antes de guardar';end if;
  save_expected=case when r.project_id is null then p_expected else null end;
 else
  if exists(select 1 from public.integration_connections where workspace_id=p_workspace and provider=p_provider and workspace_default) then raise exception 'La conexión compartida ya existe. Actualiza antes de guardar';end if;
  save_expected=null;
 end if;
 -- The server re-encrypts with project_id=null before calling this function.
 -- Old project rows remain intact; the shared account is independent of them.
 select * into r from public.save_integration(p_workspace,null,p_provider,p_config,p_fields,p_envelope,save_expected);
 update public.integration_connections set workspace_default=false,updated_at=clock_timestamp(),updated_by=auth.uid() where workspace_id=p_workspace and provider=p_provider and workspace_default and id<>r.id;
 update public.integration_connections set workspace_default=true where id=r.id returning * into r;
 if p_connection is not null and p_connection<>r.id then
  update public.integration_project_profiles set connection_id=r.id,updated_at=clock_timestamp() where workspace_id=p_workspace and provider=p_provider and connection_id=p_connection;
 end if;
 return r;
end $$;
create function public.save_workspace_integration(p_workspace uuid,p_connection uuid,p_provider text,p_config jsonb,p_fields text[],p_envelope text,p_expected timestamptz default null) returns public.integration_connections
language sql security invoker set search_path='' as $$select experimental_private.save_workspace_integration(p_workspace,p_connection,p_provider,p_config,p_fields,p_envelope,p_expected)$$;

create function experimental_private.choose_workspace_integration(p_id uuid,p_expected timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare r public.integration_connections;begin
 select * into r from public.integration_connections where id=p_id;
 if auth.uid() is null or r.id is null or public.member_role(r.workspace_id) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 perform 1 from public.workspaces where id=r.workspace_id for update;
 select * into r from public.integration_connections where id=p_id for update;
 if r.updated_at is distinct from p_expected then raise exception 'La configuración ha cambiado. Actualiza antes de continuar';end if;
 if r.source<>'encrypted' then raise exception 'Guarda la conexión privada antes de compartirla';end if;
 update public.integration_connections set workspace_default=false,updated_at=clock_timestamp(),updated_by=auth.uid() where workspace_id=r.workspace_id and provider=r.provider and workspace_default and id<>r.id;
 update public.integration_connections set workspace_default=true,updated_at=clock_timestamp(),updated_by=auth.uid() where id=r.id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(r.workspace_id,auth.uid(),'integration','Cuenta compartida entre los proyectos del equipo: '||r.provider);
end $$;
create function public.choose_workspace_integration(p_id uuid,p_expected timestamptz) returns void
language sql security invoker set search_path='' as $$select experimental_private.choose_workspace_integration(p_id,p_expected)$$;

create table public.integration_project_profiles(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid not null,
 provider text not null check(provider in ('metricool','posthog','meta_ads','app_store','google_play')),
 connection_id uuid not null,
 config jsonb not null check(jsonb_typeof(config)='object' and octet_length(config::text)<2000),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(project_id,provider),
 foreign key(project_id,workspace_id) references public.records(id,workspace_id) on delete cascade,
 foreign key(connection_id,workspace_id,provider) references public.integration_connections(id,workspace_id,provider) on delete cascade
);
alter table public.integration_project_profiles enable row level security;
revoke all on public.integration_project_profiles from public,anon,authenticated;
grant select on public.integration_project_profiles to authenticated;
create policy integration_profiles_read on public.integration_project_profiles for select to authenticated using(public.is_member(workspace_id));
create index integration_profiles_workspace on public.integration_project_profiles(workspace_id);
create index integration_profiles_connection on public.integration_project_profiles(connection_id);

create function experimental_private.save_integration_profile(p_workspace uuid,p_project uuid,p_provider text,p_connection uuid,p_config jsonb,p_expected timestamptz default null) returns void
language plpgsql security definer set search_path='' as $$
declare existing public.integration_project_profiles; allowed text[];begin
 if auth.uid() is null or public.member_role(p_workspace) is distinct from 'owner' then raise exception 'Solo el superadministrador configura las APIs';end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if not exists(select 1 from public.records where id=p_project and workspace_id=p_workspace and kind='project') then raise exception 'Proyecto no autorizado';end if;
 if not exists(select 1 from public.integration_connections where id=p_connection and workspace_id=p_workspace and provider=p_provider and enabled and (workspace_default or project_id is null)) then raise exception 'Conexión compartida no autorizada';end if;
 allowed=case p_provider when 'metricool' then array['blog_id'] when 'posthog' then array['project_id','host'] when 'meta_ads' then array['pixel_id'] when 'app_store' then array['app_id'] when 'google_play' then array['package_name'] else null end;
 if allowed is null or p_config is null or jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) k where not(k=any(allowed))) or exists(select 1 from jsonb_each(p_config) e where jsonb_typeof(e.value)<>'string') then raise exception 'Perfil no válido';end if;
 select * into existing from public.integration_project_profiles where project_id=p_project and provider=p_provider for update;
 if existing.updated_at is distinct from p_expected then raise exception 'El perfil ha cambiado. Actualiza antes de guardar';end if;
 if p_config='{}'::jsonb then
  delete from public.integration_project_profiles where project_id=p_project and provider=p_provider;
 else
  insert into public.integration_project_profiles(workspace_id,project_id,provider,connection_id,config) values(p_workspace,p_project,p_provider,p_connection,p_config)
  on conflict(project_id,provider) do update set connection_id=excluded.connection_id,config=excluded.config,updated_at=clock_timestamp();
 end if;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(p_workspace,auth.uid(),'integration','Perfil de proyecto actualizado: '||p_provider);
end $$;
create function public.save_integration_profile(p_workspace uuid,p_project uuid,p_provider text,p_connection uuid,p_config jsonb,p_expected timestamptz default null) returns void
language sql security invoker set search_path='' as $$select experimental_private.save_integration_profile(p_workspace,p_project,p_provider,p_connection,p_config,p_expected)$$;
revoke all on function experimental_private.save_workspace_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),public.save_workspace_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),experimental_private.choose_workspace_integration(uuid,timestamptz),public.choose_workspace_integration(uuid,timestamptz),experimental_private.save_integration_profile(uuid,uuid,text,uuid,jsonb,timestamptz),public.save_integration_profile(uuid,uuid,text,uuid,jsonb,timestamptz) from public,anon;
grant execute on function experimental_private.save_workspace_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),public.save_workspace_integration(uuid,uuid,text,jsonb,text[],text,timestamptz),experimental_private.choose_workspace_integration(uuid,timestamptz),public.choose_workspace_integration(uuid,timestamptz),experimental_private.save_integration_profile(uuid,uuid,text,uuid,jsonb,timestamptz),public.save_integration_profile(uuid,uuid,text,uuid,jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;
