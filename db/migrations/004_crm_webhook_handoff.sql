-- Generic CRM webhook handoff engine

alter table crm_handoffs
  add column if not exists dedup_key text,
  add column if not exists event_type text not null default 'lead.qualified',
  add column if not exists attempts integer not null default 0,
  add column if not exists max_retries integer not null default 3,
  add column if not exists next_attempt_at timestamptz null,
  add column if not exists last_error text null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists uq_crm_handoff_dedup
  on crm_handoffs(workspace_id, user_id, dedup_key)
  where dedup_key is not null;

create index if not exists idx_crm_handoff_pending
  on crm_handoffs(status, next_attempt_at, created_at);

create table if not exists crm_handoff_attempts (
  id text primary key,
  handoff_id text not null references crm_handoffs(id) on delete cascade,
  workspace_id text not null,
  user_id text not null,
  attempt_no integer not null,
  status text not null, -- success | failed
  http_status integer null,
  error_message text null,
  response_body text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_handoff_attempts_handoff
  on crm_handoff_attempts(handoff_id, attempt_no);

