begin;

alter table usage
  drop constraint if exists usage_metric_check;

alter table usage
  add constraint usage_metric_check
  check (
    metric in (
      'leads',
      'messages',
      'channels',
      'inbound_messages',
      'ai_replies',
      'follow_up_jobs',
      'crm_handoffs'
    )
  );

create or replace function increment_usage_metric(
  p_workspace_id text,
  p_user_id text,
  p_metric text,
  p_delta integer default 1,
  p_occurred_at timestamptz default now()
)
returns table (
  workspace_id text,
  user_id text,
  metric text,
  period_key text,
  used_value integer
)
language plpgsql
as $$
declare
  v_period_key text;
  v_period_start date;
  v_period_end date;
  v_id text;
begin
  if p_workspace_id is null or p_workspace_id = '' then
    raise exception 'workspace_id_required';
  end if;
  if p_user_id is null or p_user_id = '' then
    raise exception 'user_id_required';
  end if;
  if p_metric is null or p_metric = '' then
    raise exception 'metric_required';
  end if;

  if p_metric = 'channels' then
    v_period_key := 'current';
    v_period_start := null;
    v_period_end := null;
  else
    v_period_key := to_char(date_trunc('month', p_occurred_at), 'YYYY-MM');
    v_period_start := date_trunc('month', p_occurred_at)::date;
    v_period_end := (date_trunc('month', p_occurred_at) + interval '1 month')::date;
  end if;

  v_id := concat('usage_', p_workspace_id, '_', p_user_id, '_', p_metric, '_', v_period_key);

  insert into usage (
    id,
    workspace_id,
    user_id,
    metric,
    period_key,
    period_start,
    period_end,
    used_value,
    limit_value,
    created_at,
    updated_at
  )
  values (
    v_id,
    p_workspace_id,
    p_user_id,
    p_metric,
    v_period_key,
    v_period_start,
    v_period_end,
    greatest(0, p_delta),
    null,
    now(),
    now()
  )
  on conflict (workspace_id, user_id, metric, period_key)
  do update set
    used_value = usage.used_value + greatest(0, p_delta),
    updated_at = now();

  return query
  select
    u.workspace_id,
    u.user_id,
    u.metric,
    u.period_key,
    u.used_value
  from usage u
  where
    u.workspace_id = p_workspace_id
    and u.user_id = p_user_id
    and u.metric = p_metric
    and u.period_key = v_period_key
  limit 1;
end;
$$;

commit;
