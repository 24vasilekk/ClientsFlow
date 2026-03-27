-- CFlow core durable storage (PostgreSQL / Supabase / Neon)
-- Safe to run in Supabase SQL editor or any PostgreSQL 14+

create table if not exists channel_connections (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  channel text not null,
  status text not null default 'active',
  display_name text not null default '',
  endpoint_url text not null default '',
  access_token text not null default '',
  bot_token text not null default '',
  credentials_ref text not null default '',
  settings jsonb not null default '{}'::jsonb,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, channel)
);

create table if not exists leads (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  conversation_id text not null,
  channel text not null,
  external_lead_id text null,
  name text null,
  phone text null,
  email text null,
  city text null,
  stage text not null default 'new',
  score integer null,
  estimated_revenue numeric(14,2) null,
  lost_reason text null,
  source_label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  channel text not null,
  connection_id text not null references channel_connections(id) on delete cascade,
  external_conversation_id text not null,
  lead_id text not null references leads(id) on delete cascade,
  status text not null default 'active',
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, channel, external_conversation_id)
);

create table if not exists messages (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  conversation_id text not null references conversations(id) on delete cascade,
  lead_id text not null references leads(id) on delete cascade,
  channel text not null,
  direction text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists follow_up_jobs (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  lead_id text not null references leads(id) on delete cascade,
  conversation_id text not null references conversations(id) on delete cascade,
  channel text not null,
  trigger_type text not null,
  status text not null default 'queued',
  scheduled_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_recommendations (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  lead_id text null references leads(id) on delete set null,
  conversation_id text null references conversations(id) on delete set null,
  priority text not null,
  title text not null,
  description text not null,
  action_steps jsonb not null default '[]'::jsonb,
  expected_impact text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_handoffs (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  lead_id text not null references leads(id) on delete cascade,
  conversation_id text not null references conversations(id) on delete cascade,
  target text not null,
  reason text not null default '',
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analytics_snapshots (
  id text primary key,
  workspace_id text not null,
  user_id text not null,
  snapshot_date date not null,
  scope text not null default 'dashboard',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, snapshot_date, scope)
);

create index if not exists idx_leads_workspace_user on leads(workspace_id, user_id);
create index if not exists idx_conversations_workspace_user on conversations(workspace_id, user_id);
create index if not exists idx_messages_workspace_user on messages(workspace_id, user_id);
create index if not exists idx_messages_conversation_sent on messages(conversation_id, sent_at);
create index if not exists idx_followups_workspace_user on follow_up_jobs(workspace_id, user_id, status);
create index if not exists idx_ai_recommendations_workspace_user on ai_recommendations(workspace_id, user_id, status);
create index if not exists idx_handoffs_workspace_user on crm_handoffs(workspace_id, user_id, status);
create index if not exists idx_analytics_workspace_user_date on analytics_snapshots(workspace_id, user_id, snapshot_date);

