-- Experimental OS: execute once in a fresh Supabase project.
create extension if not exists pgcrypto;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text not null check(length(name)>0));
create table public.workspaces (id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), created_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table public.members (workspace_id uuid references public.workspaces(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, role text not null check(role in ('owner','editor','viewer')), primary key(workspace_id,user_id));
create table public.records (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 kind text not null check(kind in ('north_star','goal','opportunity','idea','experiment','objective','kr','project')),
 parent_id uuid,related_id uuid,title text not null check(length(trim(title))>0),owner_id uuid,fields jsonb not null default '{}',
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),created_by_name text,updated_by_name text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,workspace_id),foreign key(parent_id,workspace_id) references public.records(id,workspace_id),foreign key(related_id,workspace_id) references public.records(id,workspace_id),foreign key(workspace_id,owner_id) references public.members(workspace_id,user_id)
);
create unique index one_north_star on public.records(workspace_id) where kind='north_star';
create index records_workspace on public.records(workspace_id);
create index records_parent on public.records(parent_id);
create table public.audit_log (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade, actor_id uuid references auth.users(id),actor_name text,action text not null,record_id uuid,title text not null,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
create index audit_workspace on public.audit_log(workspace_id,created_at desc);
create table public.invitations (id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,token uuid not null unique default gen_random_uuid(),role text not null check(role in ('editor','viewer')),expires_at timestamptz not null default now()+interval '7 days',used_by uuid references auth.users(id),created_by uuid not null references auth.users(id));
create function public.member_role(w uuid) returns text language sql stable security definer set search_path=public as $$ select role from public.members where workspace_id=w and user_id=auth.uid() $$;
create function public.is_member(w uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.members where workspace_id=w and user_id=auth.uid()) $$;
create function public.on_signup() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,name) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Miembro'));return new;end $$;
create trigger signup after insert on auth.users for each row execute function public.on_signup();
-- Backfill users if Auth already contains accounts.
insert into public.profiles(id,name) select id,coalesce(nullif(trim(raw_user_meta_data->>'name'),''),'Miembro') from auth.users on conflict do nothing;
create function public.create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path=public as $$ declare w uuid; begin if auth.uid() is null then raise exception 'Autenticación requerida';end if; insert into public.workspaces(name,created_by) values(workspace_name,auth.uid()) returning id into w;insert into public.members values(w,auth.uid(),'owner');return w;end $$;
create function public.create_invitation(w uuid, invite_role text) returns uuid language plpgsql security definer set search_path=public as $$ declare t uuid;begin if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el propietario puede invitar';end if;insert into public.invitations(workspace_id,role,created_by) values(w,invite_role,auth.uid()) returning token into t;return t;end $$;
create function public.join_workspace(invite_token uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare inv public.invitations;begin if auth.uid() is null then raise exception 'Autenticación requerida';end if;select * into inv from public.invitations where token=invite_token and used_by is null and expires_at>now() for update;if not found then raise exception 'Invitación inválida, usada o caducada';end if;insert into public.members values(inv.workspace_id,auth.uid(),inv.role) on conflict do nothing;update public.invitations set used_by=auth.uid() where id=inv.id;insert into public.audit_log(workspace_id,actor_id,action,title) values(inv.workspace_id,auth.uid(),'join','Nuevo miembro');return inv.workspace_id;end $$;
create function public.change_member_role(w uuid, member_id uuid, new_role text) returns void language plpgsql security definer set search_path=public as $$ begin if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el propietario puede cambiar roles';end if;if new_role not in ('editor','viewer') then raise exception 'Rol no válido';end if;update public.members set role=new_role where workspace_id=w and user_id=member_id and role<>'owner';if not found then raise exception 'Miembro inexistente o propietario';end if;insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'role','Rol actualizado a '||new_role);end $$;
create function public.revoke_invitation(w uuid, invitation_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el propietario puede revocar';end if;delete from public.invitations where id=invitation_id and workspace_id=w;end $$;
create function public.validate_record() returns trigger language plpgsql security definer set search_path=public as $$
declare pk text; expected text; k text; linked uuid; variants jsonb; v jsonb; traffic numeric; begin
 if tg_op='UPDATE' and (new.workspace_id<>old.workspace_id or new.id<>old.id or new.kind<>old.kind) then raise exception 'La identidad y el tipo no se pueden cambiar';end if;
 expected:=case new.kind when 'goal' then 'north_star' when 'opportunity' then 'goal' when 'idea' then 'opportunity' when 'experiment' then 'idea' when 'kr' then 'objective' else null end;
 if expected is not null then select kind into pk from public.records where id=new.parent_id and workspace_id=new.workspace_id;if pk is distinct from expected then raise exception 'Padre inválido para %',new.kind;end if;elsif new.parent_id is not null then raise exception 'Este tipo debe ser raíz';end if;
 if new.related_id is not null then select kind into k from public.records where id=new.related_id and workspace_id=new.workspace_id;if new.kind not in ('kr','project') or k is distinct from 'goal' then raise exception 'Vinculación Goal inválida';end if;end if;
 foreach k in array array['impact','confidence','ease'] loop
 if new.fields ? k and ((new.fields->>k)::numeric not between 1 and 10 or (new.fields->>k)::numeric<>trunc((new.fields->>k)::numeric)) then raise exception 'ICE debe estar entre 1 y 10';end if;
end loop;
if new.kind='experiment' then
 variants:=coalesce(nullif(new.fields->>'variants',''),'[]')::jsonb;
 if jsonb_typeof(variants)<>'array' then raise exception 'Variantes inválidas';end if;
 traffic:=0;
 for v in select value from jsonb_array_elements(variants) loop
  if coalesce(trim(v->>'name'),'')='' then raise exception 'Nombre de variante requerido';end if;
  if coalesce((v->>'traffic')::numeric,-1) not between 0 and 100 then raise exception 'Tráfico inválido';end if;
  if coalesce((v->>'exposed')::numeric,-1)<0 or coalesce((v->>'conversions')::numeric,-1)<0 or (v->>'conversions')::numeric>(v->>'exposed')::numeric or (v->>'exposed')::numeric<>trunc((v->>'exposed')::numeric) or (v->>'conversions')::numeric<>trunc((v->>'conversions')::numeric) then raise exception 'Muestra inválida';end if;
  traffic:=traffic+(v->>'traffic')::numeric;
 end loop;
 if jsonb_array_length(variants)>0 and new.fields->>'method' in ('A/B aleatorizado','Test multivariante') and abs(traffic-100)>0.001 then raise exception 'El tráfico debe sumar 100%%';end if;
 if new.fields->>'status' in ('En curso','En análisis','Finalizado') and new.fields->>'method' in ('A/B aleatorizado','Test multivariante') then
  if jsonb_array_length(variants)<2 or (new.fields->>'method'='A/B aleatorizado' and jsonb_array_length(variants)<>2) then raise exception 'Número de variantes inválido';end if;
 end if;
 if coalesce(new.fields->>'analyst_id','')<>'' and not exists(select 1 from public.members where workspace_id=new.workspace_id and user_id=(new.fields->>'analyst_id')::uuid) then raise exception 'Analista inválido';end if;
  if coalesce(new.fields->>'status','Backlog') not in ('Backlog','Diseñado','En curso','En análisis','Finalizado','Archivado') then raise exception 'Estado inválido';end if;
  if new.fields->>'status' in ('En curso','En análisis','Finalizado') then
   foreach k in array array['hypothesis','metric','success_criteria','method','start','end','baseline','target'] loop if coalesce(trim(new.fields->>k),'')='' then raise exception 'Falta % para lanzar',k;end if;end loop;
   if new.owner_id is null and (tg_op='INSERT' or old.fields->>'status' is distinct from new.fields->>'status' or old.owner_id is null) then raise exception 'Asigna un responsable antes de lanzar';end if;
  end if;
  if new.fields->>'status'='Finalizado' then foreach k in array array['result','conclusion','learning','decision'] loop if coalesce(trim(new.fields->>k),'')='' then raise exception 'Falta % para cerrar',k;end if;end loop;end if;
  foreach k in array array['cost','sample_target','control_n','variant_n','control_success','variant_success'] loop if new.fields ? k and (new.fields->>k)::numeric<0 then raise exception 'Valores negativos no permitidos';end if;end loop;
  if coalesce((new.fields->>'control_success')::numeric,0)>coalesce((new.fields->>'control_n')::numeric,0) or coalesce((new.fields->>'variant_success')::numeric,0)>coalesce((new.fields->>'variant_n')::numeric,0) then raise exception 'Conversiones mayores que muestras';end if;
  if coalesce(new.fields->>'kr_ids','')<>'' then foreach linked in array string_to_array(new.fields->>'kr_ids',',')::uuid[] loop if not exists(select 1 from public.records where id=linked and workspace_id=new.workspace_id and kind='kr') then raise exception 'Key Result inválido';end if;end loop;end if;
  if coalesce(new.fields->>'project_id','')<>'' and not exists(select 1 from public.records where id=(new.fields->>'project_id')::uuid and workspace_id=new.workspace_id and kind='project') then raise exception 'Proyecto inválido';end if;
 end if;
 if coalesce(new.fields->>'start','')<>'' and coalesce(new.fields->>'end','')<>'' and (new.fields->>'end')::date<(new.fields->>'start')::date then raise exception 'Fechas inválidas';end if;
 if new.kind='opportunity' and (new.fields->>'focus')::boolean=true then perform 1 from public.workspaces where id=new.workspace_id for update;end if;
 if new.kind='opportunity' and (new.fields->>'focus')::boolean=true and not exists(select 1 from public.records where id=new.id and coalesce((fields->>'focus')::boolean,false)) and (select count(*) from public.records where workspace_id=new.workspace_id and kind='opportunity' and (fields->>'focus')::boolean=true)>=5 then raise exception 'Selecciona un máximo de 5 oportunidades prioritarias';end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();new.created_by_name:=(select name from public.profiles where id=auth.uid());new.created_at:=now();else new.created_by:=old.created_by;new.created_by_name:=old.created_by_name;new.created_at:=old.created_at;end if;new.updated_by_name:=(select name from public.profiles where id=auth.uid());new.updated_by:=auth.uid();new.updated_at:=now();return new;
end $$;
create trigger record_validation before insert or update on public.records for each row execute function public.validate_record();
create function public.audit_record() returns trigger language plpgsql security definer set search_path=public as $$ begin if tg_op='DELETE' then insert into public.audit_log(workspace_id,actor_id,action,record_id,title,old_data) values(old.workspace_id,auth.uid(),'delete',old.id,old.title,to_jsonb(old));return old;else insert into public.audit_log(workspace_id,actor_id,action,record_id,title,old_data,new_data) values(new.workspace_id,auth.uid(),lower(tg_op),new.id,new.title,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;end if;end $$;
create trigger record_audit after insert or update or delete on public.records for each row execute function public.audit_record();
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.records enable row level security;
alter table public.audit_log enable row level security;
alter table public.invitations enable row level security;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or exists(select 1 from public.members m where m.user_id=profiles.id and public.is_member(m.workspace_id)));
create policy workspace_read on public.workspaces for select to authenticated using(public.is_member(id));
create policy members_read on public.members for select to authenticated using(public.is_member(workspace_id));
create policy records_read on public.records for select to authenticated using(public.is_member(workspace_id));
create policy records_insert on public.records for insert to authenticated with check(public.member_role(workspace_id) in ('owner','editor'));
create policy records_update on public.records for update to authenticated using(public.member_role(workspace_id) in ('owner','editor')) with check(public.member_role(workspace_id) in ('owner','editor'));
create policy records_delete on public.records for delete to authenticated using(public.member_role(workspace_id) in ('owner','editor'));
create policy audit_read on public.audit_log for select to authenticated using(public.is_member(workspace_id));
create policy invitations_read on public.invitations for select to authenticated using(public.member_role(workspace_id)='owner');
-- No direct member, workspace, invitation or audit mutations from browser roles.
revoke all on public.workspaces,public.members,public.invitations,public.audit_log,public.profiles from anon,authenticated;
grant select on public.workspaces,public.members,public.invitations,public.audit_log,public.profiles to authenticated;
revoke all on public.records from anon,authenticated;
grant select,insert,update,delete on public.records to authenticated;
revoke all on function public.create_workspace(text),public.create_invitation(uuid,text),public.join_workspace(uuid),public.change_member_role(uuid,uuid,text),public.revoke_invitation(uuid,uuid),public.member_role(uuid),public.is_member(uuid) from public;
grant execute on function public.create_workspace(text),public.create_invitation(uuid,text),public.join_workspace(uuid),public.change_member_role(uuid,uuid,text),public.revoke_invitation(uuid,uuid),public.member_role(uuid),public.is_member(uuid) to authenticated;
revoke all on function public.validate_record(),public.audit_record(),public.on_signup() from public;

create function public.guard_record_delete() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if exists(select 1 from public.records r where r.workspace_id=old.workspace_id and ((r.fields->>'project_id')=old.id::text or old.id::text=any(string_to_array(r.fields->>'kr_ids',',')))) then raise exception 'Este registro está vinculado a un experimento. Desvincúlalo antes de eliminarlo.';end if;
 return old;
end $$;
create trigger record_delete_guard before delete on public.records for each row execute function public.guard_record_delete();
revoke all on function public.guard_record_delete() from public;
create function public.remove_member(w uuid, member_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if public.member_role(w) is distinct from 'owner' then raise exception 'Solo el propietario puede retirar el acceso';end if;
 if not exists(select 1 from public.members where workspace_id=w and user_id=member_id and role<>'owner') then raise exception 'Miembro inexistente o propietario';end if;
 update public.records set owner_id=case when owner_id=member_id then null else owner_id end,fields=case when fields->>'analyst_id'=member_id::text then fields-'analyst_id' else fields end where workspace_id=w and (owner_id=member_id or fields->>'analyst_id'=member_id::text);
 delete from public.members where workspace_id=w and user_id=member_id;
 insert into public.audit_log(workspace_id,actor_id,action,title) values(w,auth.uid(),'remove_member','Acceso retirado a un miembro');
end $$;
revoke all on function public.remove_member(uuid,uuid) from public;
grant execute on function public.remove_member(uuid,uuid) to authenticated;

create function public.stamp_audit_identity() returns trigger language plpgsql security definer set search_path=public as $$ begin
 new.actor_id:=auth.uid();new.actor_name:=(select name from public.profiles where id=auth.uid());return new;
end $$;
create trigger audit_identity before insert on public.audit_log for each row execute function public.stamp_audit_identity();
revoke all on function public.stamp_audit_identity() from public;
