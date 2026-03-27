-- Follow-up engine operational fields and dedup safety

alter table follow_up_jobs
  add column if not exists dedup_key text,
  add column if not exists provider text not null default 'local',
  add column if not exists provider_job_id text null,
  add column if not exists attempts integer not null default 0,
  add column if not exists max_retries integer not null default 3,
  add column if not exists last_error text null,
  add column if not exists canceled_at timestamptz null,
  add column if not exists executed_at timestamptz null;

create unique index if not exists uq_follow_up_dedup
  on follow_up_jobs(workspace_id, user_id, dedup_key)
  where dedup_key is not null;

create index if not exists idx_follow_up_due
  on follow_up_jobs(status, scheduled_at);

