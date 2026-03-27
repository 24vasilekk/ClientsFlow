-- Channel connection manager fields: lifecycle, health, sync, token storage metadata

alter table channel_connections
  add column if not exists channel_type text not null default 'messaging',
  add column if not exists account_id text not null default '',
  add column if not exists page_id text not null default '',
  add column if not exists business_id text not null default '',
  add column if not exists encrypted_access_token text not null default '',
  add column if not exists token_storage text not null default 'dev_placeholder',
  add column if not exists refresh_metadata jsonb not null default '{}'::jsonb,
  add column if not exists health_status text not null default 'unknown',
  add column if not exists last_sync_at timestamptz null,
  add column if not exists last_health_check_at timestamptz null,
  add column if not exists last_error text null;

create index if not exists idx_channel_connections_scope
  on channel_connections(workspace_id, user_id, channel, status);

create index if not exists idx_channel_connections_health
  on channel_connections(workspace_id, user_id, health_status, last_health_check_at desc);
