-- Workspace model: company-scoped tenancy + members/roles

create table if not exists workspaces (
  id text primary key,
  name text not null default '',
  owner_user_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('active', 'disabled'))
);

create table if not exists workspace_members (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null,
  status text not null default 'active',
  invited_by text null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  check (role in ('owner', 'admin', 'member')),
  check (status in ('active', 'invited', 'disabled'))
);

create index if not exists idx_workspace_members_user
  on workspace_members(user_id, workspace_id);

create index if not exists idx_workspace_members_workspace
  on workspace_members(workspace_id, role, status);

-- Backfill workspaces from existing business tables
with discovered as (
  select distinct workspace_id as id, min(user_id) as owner_user_id
  from (
    select workspace_id, user_id from leads
    union all
    select workspace_id, user_id from conversations
    union all
    select workspace_id, user_id from messages
    union all
    select workspace_id, user_id from channel_connections
    union all
    select workspace_id, user_id from analytics_snapshots
  ) t
  where workspace_id is not null and workspace_id <> ''
  group by workspace_id
)
insert into workspaces (id, name, owner_user_id, status, created_at, updated_at)
select
  d.id,
  case
    when d.id like 'ws_%' then 'Workspace ' || right(d.id, 8)
    else 'Workspace ' || d.id
  end as name,
  coalesce(nullif(d.owner_user_id, ''), 'system'),
  'active',
  now(),
  now()
from discovered d
on conflict (id) do update
set updated_at = excluded.updated_at;

-- Backfill members from existing (workspace_id, user_id) pairs
with members as (
  select distinct workspace_id, user_id
  from (
    select workspace_id, user_id from leads
    union all
    select workspace_id, user_id from conversations
    union all
    select workspace_id, user_id from messages
    union all
    select workspace_id, user_id from channel_connections
    union all
    select workspace_id, user_id from analytics_snapshots
  ) t
  where workspace_id is not null and workspace_id <> '' and user_id is not null and user_id <> ''
),
owners as (
  select id as workspace_id, owner_user_id
  from workspaces
)
insert into workspace_members (
  id,
  workspace_id,
  user_id,
  role,
  status,
  invited_by,
  joined_at,
  created_at,
  updated_at
)
select
  'wm_' || md5(m.workspace_id || ':' || m.user_id),
  m.workspace_id,
  m.user_id,
  case when o.owner_user_id = m.user_id then 'owner' else 'member' end,
  'active',
  null,
  now(),
  now(),
  now()
from members m
left join owners o on o.workspace_id = m.workspace_id
on conflict (workspace_id, user_id) do update
set updated_at = excluded.updated_at;

-- Add workspace FK references to core entities (NOT VALID for safe rollout)
alter table leads
  add constraint if not exists fk_leads_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table conversations
  add constraint if not exists fk_conversations_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table messages
  add constraint if not exists fk_messages_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table channel_connections
  add constraint if not exists fk_channel_connections_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table follow_up_jobs
  add constraint if not exists fk_follow_up_jobs_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table ai_recommendations
  add constraint if not exists fk_ai_recommendations_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table crm_handoffs
  add constraint if not exists fk_crm_handoffs_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table analytics_snapshots
  add constraint if not exists fk_analytics_snapshots_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table ingestion_events
  add constraint if not exists fk_ingestion_events_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table ai_decision_logs
  add constraint if not exists fk_ai_decision_logs_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

alter table crm_handoff_attempts
  add constraint if not exists fk_crm_handoff_attempts_workspace
  foreign key (workspace_id) references workspaces(id) not valid;

