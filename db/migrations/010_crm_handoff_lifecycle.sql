-- CRM handoff lifecycle hardening:
-- pending -> claimed -> processing -> success/retry_scheduled/failed/canceled

alter table crm_handoffs
  add column if not exists claimed_at timestamptz null,
  add column if not exists claimed_by text null,
  add column if not exists processing_deadline timestamptz null,
  add column if not exists canceled_at timestamptz null;

create index if not exists idx_crm_handoff_claimable
  on crm_handoffs(status, next_attempt_at, claimed_at, processing_deadline);

create index if not exists idx_crm_handoff_processing_deadline
  on crm_handoffs(status, processing_deadline)
  where status in ('claimed', 'processing');

create or replace function recover_stale_crm_handoffs(
  p_now timestamptz default now()
) returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  update crm_handoffs
  set
    status = 'retry_scheduled',
    next_attempt_at = p_now,
    last_error = coalesce(last_error, 'processing_deadline_exceeded'),
    claimed_at = null,
    claimed_by = null,
    processing_deadline = null,
    updated_at = p_now
  where status in ('claimed', 'processing')
    and processing_deadline is not null
    and processing_deadline <= p_now;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function claim_crm_handoff(
  p_worker_id text,
  p_now timestamptz default now(),
  p_processing_timeout interval default interval '10 minutes'
) returns setof crm_handoffs
language plpgsql
as $$
begin
  perform recover_stale_crm_handoffs(p_now);

  return query
  with candidate as (
    select id
    from crm_handoffs
    where status in ('pending', 'retry_scheduled')
      and coalesce(next_attempt_at, p_now) <= p_now
    order by coalesce(next_attempt_at, p_now) asc
    for update skip locked
    limit 1
  )
  update crm_handoffs h
  set
    status = 'claimed',
    claimed_at = p_now,
    claimed_by = p_worker_id,
    processing_deadline = p_now + p_processing_timeout,
    attempts = coalesce(h.attempts, 0) + 1,
    updated_at = p_now
  from candidate c
  where h.id = c.id
  returning h.*;
end;
$$;

create or replace function claim_crm_handoff_by_id(
  p_handoff_id text,
  p_worker_id text,
  p_now timestamptz default now(),
  p_processing_timeout interval default interval '10 minutes'
) returns setof crm_handoffs
language plpgsql
as $$
begin
  perform recover_stale_crm_handoffs(p_now);

  return query
  update crm_handoffs h
  set
    status = 'claimed',
    claimed_at = p_now,
    claimed_by = p_worker_id,
    processing_deadline = p_now + p_processing_timeout,
    attempts = coalesce(h.attempts, 0) + 1,
    updated_at = p_now
  where h.id = p_handoff_id
    and h.status in ('pending', 'retry_scheduled')
  returning h.*;
end;
$$;

