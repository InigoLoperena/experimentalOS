-- Administrative repair for an existing internal team. Never expose as a client RPC.
-- Replace ADMINISTRATOR_EMAIL with the explicitly approved owner's confirmed email.
-- Preserve all existing spaces, records and memberships.
begin;
do $$
declare administrator uuid; team uuid;
begin
  if (select count(*) from auth.users where lower(email)=lower('ADMINISTRATOR_EMAIL') and email_confirmed_at is not null)<>1 then
    raise exception 'Debe existir exactamente una cuenta confirmada del administrador';
  end if;
  select id into administrator from auth.users where lower(email)=lower('ADMINISTRATOR_EMAIL') and email_confirmed_at is not null;
  select workspace_id into team from experimental_private.public_preview where singleton;
  if team is null or not exists(select 1 from public.workspaces where id=team) then
    raise exception 'No se ha identificado el equipo existente';
  end if;
  insert into public.members(workspace_id,user_id,role) values(team,administrator,'owner')
    on conflict (workspace_id,user_id) do update set role='owner';
end $$;
commit;
