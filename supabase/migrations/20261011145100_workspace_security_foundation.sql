-- Additive baseline for the approved private multi-workspace pilot.
-- The historical 001-010 files describe earlier installations; do not replay them
-- against a live project. This migration preserves workspaces, memberships and records.
begin;

-- Previously opted-in private team data becomes private for the pilot.
-- Keep the configuration row so the decision is reversible without losing its identity.
update experimental_private.public_preview set enabled = false where singleton;
revoke all on function public.stamp_record_comment_identity() from public, anon, authenticated;
alter function public.stamp_record_comment_identity() set search_path = public, pg_temp;

-- A server key must never follow editable project fields to a different account.
-- Only database administrators/service code may provision these verified mappings.
create table public.posthog_project_bindings (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  external_project_id text not null check (external_project_id ~ '^[a-zA-Z0-9_-]+$'),
  host text not null check (host ~ '^https://[^/?#[:space:]]+$'),
  credential_ref text not null check (credential_ref = 'legacy_posthog_server'),
  created_at timestamptz not null default now(),
  primary key (workspace_id, project_id),
  foreign key (project_id, workspace_id) references public.records(id, workspace_id) on delete cascade
);
alter table public.posthog_project_bindings enable row level security;
revoke all on public.posthog_project_bindings from public, anon, authenticated;
grant select on public.posthog_project_bindings to authenticated;
create policy posthog_bindings_read on public.posthog_project_bindings
  for select to authenticated using (public.is_member(workspace_id));

-- Preserve only the original team's existing connection, never arbitrary future tenants.
insert into public.posthog_project_bindings(workspace_id, project_id, external_project_id, host, credential_ref)
select r.workspace_id, r.id, trim(r.fields->>'posthog_project_id'),
  rtrim(coalesce(nullif(trim(r.fields->>'posthog_host'), ''), 'https://us.posthog.com'), '/'),
  'legacy_posthog_server'
from public.records r
join experimental_private.public_preview p on p.workspace_id = r.workspace_id and p.singleton
where r.kind = 'project' and trim(r.fields->>'posthog_project_id') ~ '^[a-zA-Z0-9_-]+$';

notify pgrst, 'reload schema';
commit;
