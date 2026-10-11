begin;

-- Composite references prevent even a member of two teams from mixing their data.
alter table public.records add constraint records_experiment_scope_key unique (id, workspace_id, project_id);

create table experimental_private.experiment_counters (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null,
  prefix text not null,
  next_number bigint not null default 0,
  primary key (workspace_id, project_id),
  unique (workspace_id, prefix),
  foreign key (project_id, workspace_id) references public.records(id, workspace_id) on delete cascade
);
alter table experimental_private.experiment_counters enable row level security;
revoke all on experimental_private.experiment_counters from public, anon, authenticated;

create table public.experiment_specs (
  experiment_id uuid primary key,
  workspace_id uuid not null,
  project_id uuid not null,
  code text not null,
  status text not null default 'draft' check (status in ('draft','prepared','running','completed','archived')),
  budget numeric(12,2) check (budget >= 0 and budget <= 1000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  budget_period text not null default 'daily' check (budget_period in ('daily','total')),
  planned_start date,
  planned_end date,
  timezone text not null default 'UTC' check (length(timezone) between 1 and 80),
  updated_at timestamptz not null default now(),
  unique (experiment_id, workspace_id, project_id),
  unique (workspace_id, code),
  foreign key (experiment_id, workspace_id, project_id) references public.records(id, workspace_id, project_id) on delete cascade,
  check (planned_end is null or planned_start is null or planned_end >= planned_start)
);

create function experimental_private.stamp_experiment_spec() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prefix_value text; number_value bigint;
begin
  if auth.uid() is not null and public.member_role(new.workspace_id) is distinct from 'owner'
    and public.member_role(new.workspace_id) is distinct from 'editor' then
    raise exception 'No tienes permiso para editar este experimento';
  end if;
  if not exists(select 1 from public.records where id=new.experiment_id and workspace_id=new.workspace_id
    and project_id=new.project_id and kind='experiment') then raise exception 'Experimento inválido'; end if;
  if tg_op='UPDATE' then
    if (new.experiment_id,new.workspace_id,new.project_id,new.code) is distinct from
      (old.experiment_id,old.workspace_id,old.project_id,old.code) then raise exception 'La identidad del experimento no puede cambiar'; end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('experiment-code:' || new.workspace_id::text,0));
    select prefix into prefix_value from experimental_private.experiment_counters
      where workspace_id=new.workspace_id and project_id=new.project_id;
    if prefix_value is null then
      select left(trim(both '-' from regexp_replace(upper(title),'[^A-Z0-9]+','-','g')),35)
        into prefix_value from public.records where id=new.project_id and workspace_id=new.workspace_id and kind='project';
      prefix_value := coalesce(nullif(prefix_value,''),'PROJECT');
      if exists(select 1 from experimental_private.experiment_counters where workspace_id=new.workspace_id and prefix=prefix_value) then
        prefix_value := prefix_value || '-' || replace(new.project_id::text,'-','');
      end if;
    end if;
    insert into experimental_private.experiment_counters(workspace_id,project_id,prefix,next_number)
      values(new.workspace_id,new.project_id,prefix_value,1)
      on conflict (workspace_id,project_id) do update set next_number=experimental_private.experiment_counters.next_number+1
      returning next_number,prefix into number_value,prefix_value;
    new.code := 'EXP-' || prefix_value || '-' || lpad(number_value::text,greatest(4,length(number_value::text)), '0');
  end if;
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Zona horaria inválida'; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function experimental_private.stamp_experiment_spec() from public, anon, authenticated;
create trigger experiment_spec_identity before insert or update on public.experiment_specs
  for each row execute function experimental_private.stamp_experiment_spec();

create function experimental_private.initialize_experiment_spec() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind='experiment' then
    insert into public.experiment_specs(experiment_id,workspace_id,project_id,code)
      values(new.id,new.workspace_id,new.project_id,'');
  end if;
  return new;
end $$;
revoke all on function experimental_private.initialize_experiment_spec() from public, anon, authenticated;
create trigger experiment_spec_create after insert on public.records
  for each row execute function experimental_private.initialize_experiment_spec();
insert into public.experiment_specs(experiment_id,workspace_id,project_id,code)
  select id,workspace_id,project_id,'' from public.records where kind='experiment' order by created_at,id;

create table public.experiment_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  experiment_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 40),
  description text not null default '' check (length(description) <= 10000),
  is_control boolean not null default false,
  allocation numeric(5,2) check (allocation >= 0 and allocation <= 100),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id,label),
  unique (id,workspace_id,project_id,experiment_id),
  foreign key (experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade
);
create unique index experiment_one_control on public.experiment_variants(experiment_id) where is_control;

create table public.external_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  experiment_id uuid not null,
  variant_id uuid,
  provider text not null check (provider in ('meta_ads','google_ads','posthog','metricool','smartlead','linkedin_ads','tiktok_ads','other')),
  resource_type text not null default 'campaign' check (resource_type in ('campaign','adset','ad','post','experiment','other')),
  external_id text check (length(trim(external_id)) between 1 and 200),
  external_url text check (external_url ~ '^https://[^[:space:]]+$' and length(external_url) <= 2000),
  label text not null default '' check (length(label) <= 200),
  observed_status text not null default 'unknown' check (observed_status in ('unknown','draft','paused','running','completed','archived','unavailable')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (experiment_id,provider,resource_type,external_id),
  check (external_id is not null or external_url is not null),
  unique (id,workspace_id,project_id,experiment_id),
  foreign key (experiment_id,workspace_id,project_id) references public.experiment_specs(experiment_id,workspace_id,project_id) on delete cascade,
  foreign key (variant_id,workspace_id,project_id,experiment_id) references public.experiment_variants(id,workspace_id,project_id,experiment_id)
);
create unique index external_resource_url_only on public.external_resources(experiment_id,provider,resource_type,external_url) where external_id is null;

create table public.metric_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  experiment_id uuid not null,
  resource_id uuid not null,
  metric text not null check (metric ~ '^[a-z][a-z0-9_]{0,63}$'),
  unit text not null check (unit in ('count','currency','ratio','number')),
  currency text check (currency ~ '^[A-Z]{3}$'),
  value numeric not null check (value >= 0 and value < 1000000000000),
  period_start date not null,
  period_end date not null,
  source text not null default 'manual' check (source in ('manual','csv','api')),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resource_id,metric,period_start,period_end),
  foreign key (resource_id,workspace_id,project_id,experiment_id) references public.external_resources(id,workspace_id,project_id,experiment_id) on delete cascade,
  check (period_end >= period_start),
  check ((unit='currency' and currency is not null) or (unit<>'currency' and currency is null)),
  check (unit<>'ratio' or value<=1),
  check (unit<>'count' or value=trunc(value))
);

create function experimental_private.stamp_experiment_child() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    if (new.id,new.workspace_id,new.project_id,new.experiment_id) is distinct from
      (old.id,old.workspace_id,old.project_id,old.experiment_id) then raise exception 'La identidad del registro no puede cambiar'; end if;
    new.created_at := old.created_at; new.created_by := old.created_by;
  else
    new.created_by := auth.uid(); new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function experimental_private.stamp_experiment_child() from public, anon, authenticated;

do $$ declare table_name text;
begin
  foreach table_name in array array['experiment_specs','experiment_variants','external_resources','metric_observations'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from public, anon, authenticated',table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))',table_name || '_read',table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.member_role(workspace_id) in (''owner'',''editor''))',table_name || '_insert',table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.member_role(workspace_id) in (''owner'',''editor'')) with check (public.member_role(workspace_id) in (''owner'',''editor''))',table_name || '_update',table_name);
    if table_name<>'experiment_specs' then
      execute format('create policy %I on public.%I for delete to authenticated using (public.member_role(workspace_id) in (''owner'',''editor''))',table_name || '_delete',table_name);
      execute format('create trigger %I before insert or update on public.%I for each row execute function experimental_private.stamp_experiment_child()',table_name || '_identity',table_name);
      execute format('create index %I on public.%I (workspace_id,experiment_id)',table_name || '_scope',table_name);
    end if;
  end loop;
end $$;
-- Specifications are created with the experiment; browser users may only read/update them.
revoke insert,delete on public.experiment_specs from authenticated;
create index experiment_specs_scope on public.experiment_specs(workspace_id,project_id);
create index metric_resource_period on public.metric_observations(resource_id,period_start,period_end);
create index external_resources_variant on public.external_resources(variant_id) where variant_id is not null;

-- Users can import their own evidence, but cannot impersonate an API synchronizer.
alter policy metric_observations_insert on public.metric_observations
  with check (public.member_role(workspace_id) in ('owner','editor') and source in ('manual','csv'));
alter policy metric_observations_update on public.metric_observations
  using (public.member_role(workspace_id) in ('owner','editor') and source in ('manual','csv'))
  with check (public.member_role(workspace_id) in ('owner','editor') and source in ('manual','csv'));
alter policy metric_observations_delete on public.metric_observations
  using (public.member_role(workspace_id) in ('owner','editor') and source in ('manual','csv'));

create function experimental_private.audit_experiment_monitoring() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; previous_data jsonb; experiment uuid; workspace uuid; record_title text;
begin
  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  experiment := (row_data->>'experiment_id')::uuid;
  workspace := (row_data->>'workspace_id')::uuid;
  select title into record_title from public.records where id=experiment and workspace_id=workspace;
  if record_title is not null then
    if tg_op in ('UPDATE','DELETE') then previous_data := to_jsonb(old); end if;
    insert into public.audit_log(workspace_id,actor_id,action,record_id,title,old_data,new_data)
      values(workspace,auth.uid(),tg_table_name || ':' || lower(tg_op),experiment,record_title,
        previous_data,case when tg_op='DELETE' then null else row_data end);
  end if;
  return coalesce(new,old);
end $$;
revoke all on function experimental_private.audit_experiment_monitoring() from public, anon, authenticated;
do $$ declare table_name text;
begin
  foreach table_name in array array['experiment_specs','experiment_variants','external_resources','metric_observations'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function experimental_private.audit_experiment_monitoring()',table_name || '_audit',table_name);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
