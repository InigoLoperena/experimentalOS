-- Public editorial content is deliberately separate from private workspace data.
-- The one initial editor is the existing, confirmed account explicitly approved
-- by the site owner. No article is created or published by this migration.
begin;

create table public.blog_editors(
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.blog_editors enable row level security;
revoke all on public.blog_editors from public,anon,authenticated;

insert into public.blog_editors(user_id)
select id from auth.users
where lower(email)='inigoloperena@gmail.com' and email_confirmed_at is not null
and (select count(*) from auth.users where lower(email)='inigoloperena@gmail.com' and email_confirmed_at is not null)=1;

create or replace function experimental_private.is_blog_editor()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.blog_editors e join auth.users u on u.id=e.user_id
  where e.user_id=auth.uid() and u.email_confirmed_at is not null
    and lower(u.email)='inigoloperena@gmail.com'
 )
$$;
revoke all on function experimental_private.is_blog_editor() from public,anon,authenticated;
grant usage on schema experimental_private to authenticated;
grant execute on function experimental_private.is_blog_editor() to authenticated;
create function public.is_blog_editor()
returns boolean language sql stable security invoker set search_path='' as $$select experimental_private.is_blog_editor()$$;
revoke all on function public.is_blog_editor() from public,anon,authenticated;
grant execute on function public.is_blog_editor() to authenticated;

create table public.blog_posts(
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(length(slug) between 1 and 100 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('administrar','feed','rss','api')),
 title text not null check(length(trim(title)) between 1 and 180),
 excerpt text not null default '' check(length(excerpt)<=360),
 body_markdown text not null default '' check(length(body_markdown)<=100000),
 author_name text not null check(length(trim(author_name)) between 1 and 120),
 status text not null default 'draft' check(status in ('draft','published')),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 check(status<>'published' or (published_at is not null and length(trim(excerpt))>0 and length(trim(body_markdown))>0))
);
create index blog_posts_publication on public.blog_posts(published_at desc) where status='published';
alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from public,anon,authenticated;
grant select(id,slug,title,excerpt,body_markdown,author_name,status,published_at,created_at,updated_at) on public.blog_posts to anon,authenticated;
grant insert(slug,title,excerpt,body_markdown,author_name,status),update(slug,title,excerpt,body_markdown,author_name,status),delete on public.blog_posts to authenticated;
create policy blog_posts_public_read on public.blog_posts for select to anon,authenticated
 using(status='published' and published_at<=now());
create policy blog_posts_editor_read on public.blog_posts for select to authenticated
 using((select public.is_blog_editor()));
create policy blog_posts_editor_insert on public.blog_posts for insert to authenticated
 with check((select public.is_blog_editor()));
create policy blog_posts_editor_update on public.blog_posts for update to authenticated
 using((select public.is_blog_editor())) with check((select public.is_blog_editor()));
create policy blog_posts_editor_delete on public.blog_posts for delete to authenticated
 using((select public.is_blog_editor()));

create function experimental_private.stamp_blog_post()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if old.published_at is not null and new.slug is distinct from old.slug then
   raise exception 'La URL publicada no puede cambiar';
  end if;
  new.id:=old.id;new.created_at:=old.created_at;new.created_by:=old.created_by;
  new.published_at:=old.published_at;
 else
  new.created_by:=auth.uid();new.created_at:=now();new.published_at:=null;
 end if;
 if new.status='published' and new.published_at is null then new.published_at:=now();end if;
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();
 return new;
end
$$;
revoke all on function experimental_private.stamp_blog_post() from public,anon,authenticated;
create trigger blog_post_identity before insert or update on public.blog_posts
 for each row execute function experimental_private.stamp_blog_post();

notify pgrst,'reload schema';
commit;
