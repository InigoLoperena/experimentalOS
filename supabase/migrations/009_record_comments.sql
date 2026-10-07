-- Comments attached to GOI records (goals, opportunities and ideas).
-- Comments are internal to workspace members. Owners/editors can post;
-- all authenticated workspace members can read.

create table public.record_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_id uuid not null,
  author_id uuid not null references auth.users(id),
  author_name text not null,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  foreign key (record_id, workspace_id)
    references public.records(id, workspace_id)
    on delete cascade
);

create index record_comments_record_created
  on public.record_comments(record_id, created_at desc);

alter table public.record_comments enable row level security;

create policy record_comments_read
  on public.record_comments
  for select
  to authenticated
  using (public.is_member(workspace_id));

create policy record_comments_insert
  on public.record_comments
  for insert
  to authenticated
  with check (
    public.member_role(workspace_id) in ('owner','editor')
    and author_id = (select auth.uid())
  );

revoke all on public.record_comments from anon, authenticated;
grant select, insert on public.record_comments to authenticated;

create function public.stamp_record_comment_identity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida';
  end if;

  new.author_id := auth.uid();
  new.author_name := coalesce(
    (select name from public.profiles where id=auth.uid()),
    'Miembro'
  );
  return new;
end
$$;

create trigger record_comment_identity
before insert on public.record_comments
for each row execute function public.stamp_record_comment_identity();

revoke all on function public.stamp_record_comment_identity() from public;
