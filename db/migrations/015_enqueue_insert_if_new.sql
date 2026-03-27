-- DB-first conflict-aware enqueue helpers:
-- return inserted flag so app runtime can avoid duplicate schedule/dispatch.

create or replace function insert_follow_up_job_if_new(
  p_id text,
  p_workspace_id text,
  p_user_id text,
  p_lead_id text,
  p_conversation_id text,
  p_channel text,
  p_trigger_type text,
  p_status text,
  p_scheduled_at timestamptz,
  p_payload jsonb,
  p_dedup_key text,
  p_provider text,
  p_max_retries integer,
  p_now timestamptz default now()
)
returns table (
  inserted boolean,
  job_id text,
  current_status text
)
language sql
as $$
  with ins as (
    insert into follow_up_jobs (
      id,
      workspace_id,
      user_id,
      lead_id,
      conversation_id,
      channel,
      trigger_type,
      status,
      scheduled_at,
      payload,
      dedup_key,
      provider,
      attempts,
      max_retries,
      claimed_at,
      claimed_by,
      processing_deadline,
      created_at,
      updated_at
    )
    values (
      p_id,
      p_workspace_id,
      p_user_id,
      p_lead_id,
      p_conversation_id,
      p_channel,
      p_trigger_type,
      p_status,
      p_scheduled_at,
      coalesce(p_payload, '{}'::jsonb),
      p_dedup_key,
      p_provider,
      0,
      greatest(0, coalesce(p_max_retries, 0)),
      null,
      null,
      null,
      p_now,
      p_now
    )
    on conflict (workspace_id, user_id, dedup_key) do nothing
    returning id, status
  ),
  existing as (
    select f.id, f.status
    from follow_up_jobs f
    where
      f.workspace_id = p_workspace_id
      and f.user_id = p_user_id
      and f.dedup_key = p_dedup_key
    order by f.created_at desc
    limit 1
  )
  select
    coalesce((select true from ins limit 1), false) as inserted,
    coalesce((select id from ins limit 1), (select id from existing limit 1)) as job_id,
    coalesce((select status from ins limit 1), (select status from existing limit 1)) as current_status;
$$;

create or replace function insert_crm_handoff_if_new(
  p_id text,
  p_workspace_id text,
  p_user_id text,
  p_lead_id text,
  p_conversation_id text,
  p_event_type text,
  p_payload jsonb,
  p_dedup_key text,
  p_max_retries integer,
  p_now timestamptz default now()
)
returns table (
  inserted boolean,
  handoff_id text,
  current_status text
)
language sql
as $$
  with ins as (
    insert into crm_handoffs (
      id,
      workspace_id,
      user_id,
      lead_id,
      conversation_id,
      target,
      reason,
      status,
      event_type,
      payload,
      dedup_key,
      attempts,
      max_retries,
      next_attempt_at,
      claimed_at,
      claimed_by,
      processing_deadline,
      canceled_at,
      created_at,
      updated_at
    )
    values (
      p_id,
      p_workspace_id,
      p_user_id,
      p_lead_id,
      p_conversation_id,
      'webhook',
      p_event_type,
      'pending',
      p_event_type,
      coalesce(p_payload, '{}'::jsonb),
      p_dedup_key,
      0,
      greatest(0, coalesce(p_max_retries, 0)),
      p_now,
      null,
      null,
      null,
      null,
      p_now,
      p_now
    )
    on conflict (workspace_id, user_id, dedup_key) do nothing
    returning id, status
  ),
  existing as (
    select h.id, h.status
    from crm_handoffs h
    where
      h.workspace_id = p_workspace_id
      and h.user_id = p_user_id
      and h.dedup_key = p_dedup_key
    order by h.created_at desc
    limit 1
  )
  select
    coalesce((select true from ins limit 1), false) as inserted,
    coalesce((select id from ins limit 1), (select id from existing limit 1)) as handoff_id,
    coalesce((select status from ins limit 1), (select status from existing limit 1)) as current_status;
$$;
