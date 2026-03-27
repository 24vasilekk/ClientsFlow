-- Unified ingestion log with raw + normalized payload and idempotency

create table if not exists ingestion_events (
  id text primary key,
  trace_id text not null,
  workspace_id text not null,
  user_id text not null,
  channel text not null,
  connection_id text not null references channel_connections(id) on delete cascade,
  source text not null default 'webhook',
  idempotency_key text not null,
  external_event_id text null,
  external_message_id text null,
  event_type text not null,
  status text not null default 'received',
  raw_payload jsonb not null,
  normalized_payload jsonb null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, connection_id, idempotency_key)
);

create index if not exists idx_ingestion_events_workspace_channel on ingestion_events(workspace_id, channel, received_at desc);
create index if not exists idx_ingestion_events_trace on ingestion_events(trace_id);
create index if not exists idx_ingestion_events_status on ingestion_events(status, received_at desc);

