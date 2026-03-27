-- Unified AI decision pipeline logs (prompt/input/output metadata)

create table if not exists ai_decision_logs (
  id text primary key,
  trace_id text not null,
  workspace_id text not null,
  user_id text not null,
  conversation_id text not null,
  lead_id text null,
  channel text not null,
  lead_stage text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  input_metadata jsonb not null default '{}'::jsonb,
  output_metadata jsonb not null default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_decision_logs_workspace on ai_decision_logs(workspace_id, user_id, created_at desc);
create index if not exists idx_ai_decision_logs_trace on ai_decision_logs(trace_id);
create index if not exists idx_ai_decision_logs_conversation on ai_decision_logs(conversation_id, created_at desc);
