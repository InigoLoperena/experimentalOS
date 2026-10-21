-- Allow Hypothesis and Research through the same per-workspace growth permissions
-- already used by GOI Tree. Keep every role and action guard unchanged.
begin;
create or replace function public.can_record_action(w uuid, k text, a text)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select coalesce((
    select m.role='owner' or (
      m.role='editor' and (
        case k
          when 'project' then 'projects'
          when 'experiment' then 'experiments'
          when 'learning' then 'learnings'
          else 'growth'
        end || '.' || a
      )=any(m.permissions)
    )
    from public.members m
    where m.workspace_id=w and m.user_id=auth.uid()
  ),false)
  and a in ('create','edit','delete')
  and k in ('project','experiment','learning','north_star','goal','opportunity',
            'idea','objective','kr','hypothesis','research');
$function$;
notify pgrst,'reload schema';
commit;
