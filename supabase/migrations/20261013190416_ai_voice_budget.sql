begin;
-- Transcription and reasoning share the monthly cap, but have independent rate windows.
-- A finished dictation can therefore be sent to the assistant immediately.
create function experimental_private.reserve_ai_usage(p_workspace uuid,p_request uuid,p_model text) returns numeric
language plpgsql security definer set search_path='' as $$
declare spent numeric;is_audio boolean;
begin
 if auth.uid() is null or not public.is_member(p_workspace) then raise exception 'No tienes acceso a la IA del equipo';end if;
 if p_model is null or p_model not in ('gpt-4.1-mini-2025-04-14','gpt-4o-mini-transcribe-2025-12-15') then raise exception 'Modelo de IA no autorizado';end if;
 is_audio:=p_model='gpt-4o-mini-transcribe-2025-12-15';
 perform pg_advisory_xact_lock(hashtextextended('ai:'||p_workspace::text,0));
 if exists(select 1 from public.ai_preparation_usage where request_id=p_request) then raise exception 'Esta solicitud ya fue procesada';end if;
 if exists(select 1 from public.ai_preparation_usage where workspace_id=p_workspace and (model='gpt-4o-mini-transcribe-2025-12-15')=is_audio and created_at>now()-interval '15 seconds') then raise exception 'Espera 15 segundos antes de otra consulta del mismo tipo';end if;
 select coalesce(sum(reserved_usd),0) into spent from public.ai_preparation_usage where workspace_id=p_workspace and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if spent+0.03>5 then raise exception 'Se ha alcanzado el límite mensual de IA de 5 USD';end if;
 insert into public.ai_preparation_usage(request_id,workspace_id,user_id,model) values(p_request,p_workspace,auth.uid(),p_model);
 return spent+0.03;
end $$;
create or replace function experimental_private.reserve_ai_chat(p_workspace uuid,p_request uuid) returns numeric
language sql security invoker set search_path='' as $$ select experimental_private.reserve_ai_usage(p_workspace,p_request,'gpt-4.1-mini-2025-04-14') $$;
create or replace function public.reserve_ai_preparation(p_workspace uuid,p_request uuid) returns numeric
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not (public.can_record_action(p_workspace,'experiment','create') or public.can_record_action(p_workspace,'experiment','edit')) then raise exception 'Solo administradores y editores pueden utilizar la IA';end if;
 return experimental_private.reserve_ai_usage(p_workspace,p_request,'gpt-4.1-mini-2025-04-14');
end $$;
create function public.reserve_ai_transcription(p_workspace uuid,p_request uuid) returns numeric
language sql security invoker set search_path='' as $$ select experimental_private.reserve_ai_usage(p_workspace,p_request,'gpt-4o-mini-transcribe-2025-12-15') $$;
revoke all on function experimental_private.reserve_ai_usage(uuid,uuid,text),public.reserve_ai_transcription(uuid,uuid),public.reserve_ai_preparation(uuid,uuid) from public,anon,authenticated;
grant execute on function experimental_private.reserve_ai_usage(uuid,uuid,text),public.reserve_ai_transcription(uuid,uuid),public.reserve_ai_preparation(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
