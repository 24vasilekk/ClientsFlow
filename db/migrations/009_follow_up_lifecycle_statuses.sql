-- Follow-up lifecycle status refinement:
-- pending -> claimed -> processing -> sent/retry_scheduled/canceled/failed/recovered

create or replace function recover_stale_follow_up_jobs(
  p_now timestamptz default now()
) returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  update follow_up_jobs
  set
    status = 'retry_scheduled',
    scheduled_at = p_now,
    last_error = coalesce(last_error, 'processing_deadline_exceeded'),
    claimed_at = null,
    claimed_by = null,
    processing_deadline = null,
    updated_at = p_now
  where status in ('processing', 'claimed')
    and processing_deadline is not null
    and processing_deadline <= p_now;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function claim_follow_up_job(
  p_worker_id text,
  p_now timestamptz default now(),
  p_processing_timeout interval default interval '10 minutes'
) returns setof follow_up_jobs
language plpgsql
as $$
begin
  perform recover_stale_follow_up_jobs(p_now);

  return query
  with candidate as (
    select id
    from follow_up_jobs
    where status in ('pending', 'retry_scheduled', 'queued', 'scheduled')
      and scheduled_at <= p_now
    order by scheduled_at asc
    for update skip locked
    limit 1
  )
  update follow_up_jobs j
  set
    status = 'claimed',
    claimed_at = p_now,
    claimed_by = p_worker_id,
    processing_deadline = p_now + p_processing_timeout,
    attempts = coalesce(j.attempts, 0) + 1,
    updated_at = p_now
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function claim_follow_up_job_by_id(
  p_job_id text,
  p_worker_id text,
  p_now timestamptz default now(),
  p_processing_timeout interval default interval '10 minutes'
) returns setof follow_up_jobs
language plpgsql
as $$
begin
  perform recover_stale_follow_up_jobs(p_now);

  return query
  update follow_up_jobs j
  set
    status = 'claimed',
    claimed_at = p_now,
    claimed_by = p_worker_id,
    processing_deadline = p_now + p_processing_timeout,
    attempts = coalesce(j.attempts, 0) + 1,
    updated_at = p_now
  where j.id = p_job_id
    and j.status in ('pending', 'retry_scheduled', 'queued', 'scheduled')
  returning j.*;
end;
$$;

-- Best-effort transition for already scheduled rows
update follow_up_jobs
set status = 'pending', updated_at = now()
where status in ('queued', 'scheduled');

