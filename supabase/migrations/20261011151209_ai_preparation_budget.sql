begin;
create table public.ai_preparation_usage (
  request_id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  model text not null default 'gpt-4.1-mini-2025-04-14',
  reserved_usd numeric(8,4) not null default 0.03 check (reserved_usd=0.03),
  created_at timestamptz not null default now()
);
alter table public.ai_preparation_usage enable row level security;
revoke all on public.ai_preparation_usage from public,anon,authenticated;
grant select on public.ai_preparation_usage to authenticated;
create policy ai_usage_read on public.ai_preparation_usage for select to authenticated using(public.is_member(workspace_id));
create index ai_usage_workspace_time on public.ai_preparation_usage(workspace_id,created_at);
-- A fixed conservative reservation bounds costs without trusting browser-reported tokens.
-- Failed requests retain their reservation; no retry can bypass the cap.
create function public.reserve_ai_preparation(p_workspace uuid,p_request uuid) returns numeric
language plpgsql security definer set search_path='' as $$
declare spent numeric;
begin
  if auth.uid() is null or coalesce(public.member_role(p_workspace),'') not in ('owner','editor') then raise exception 'Solo administradores y editores pueden utilizar la IA'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ai:' || p_workspace::text,0));
  if exists(select 1 from public.ai_preparation_usage where request_id=p_request) then raise exception 'Esta solicitud ya fue procesada'; end if;
  if exists(select 1 from public.ai_preparation_usage where workspace_id=p_workspace and created_at>now()-interval '15 seconds') then raise exception 'Espera 15 segundos antes de otra consulta'; end if;
  select coalesce(sum(reserved_usd),0) into spent from public.ai_preparation_usage where workspace_id=p_workspace and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  if spent+0.03>5 then raise exception 'Se ha alcanzado el límite mensual de IA de 5 USD'; end if;
  insert into public.ai_preparation_usage(request_id,workspace_id,user_id) values(p_request,p_workspace,auth.uid());
  return spent+0.03;
end $$;
revoke all on function public.reserve_ai_preparation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_preparation(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
