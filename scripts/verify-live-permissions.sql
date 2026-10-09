-- Read-only checks for an existing installation with an owner membership.
-- Run in Supabase SQL Editor using an administrative connection.
-- Test JWT claims stay inside this transaction; this does not create Auth sessions.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.members where role='owner' order by workspace_id limit 1),true),
       set_config('experimental_test.workspace',(select workspace_id::text from public.members where role='owner' order by workspace_id limit 1),true);
set local role authenticated;
do $$
begin
  if public.open_team_space() is distinct from current_setting('experimental_test.workspace')::uuid then
    raise exception 'El miembro existente no puede abrir su espacio';
  end if;
  if not exists(select 1 from public.workspaces where id=current_setting('experimental_test.workspace')::uuid) then
    raise exception 'RLS impide leer el espacio propio';
  end if;
  if has_function_privilege(current_user,'public.create_team(text)','execute') then
    raise exception 'Crear equipos sigue habilitado';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$
begin
  if public.open_team_space() is not null then raise exception 'Una cuenta ajena abre un espacio'; end if;
  if exists(select 1 from public.records) or exists(select 1 from public.workspaces) or exists(select 1 from public.record_attachments) or exists(select 1 from public.record_comments) then
    raise exception 'Una cuenta ajena ve datos privados';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$
begin
  if jsonb_array_length(public.get_public_preview()->'attachments')<>0 then raise exception 'Los adjuntos son públicos'; end if;
  if exists(select 1 from storage.objects where bucket_id='record-attachments') then raise exception 'El visitante ve archivos'; end if;
end $$;
reset role;
rollback;
select 'PASS: membresía existente, creación de equipos bloqueada, aislamiento de cuenta ajena y adjuntos privados; comprobaciones sin escrituras' as verification;
