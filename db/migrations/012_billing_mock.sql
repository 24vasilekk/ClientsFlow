begin;

create table if not exists plans (
  id text primary key,
  title text not null,
  description text not null default '',
  price_monthly numeric(12,2) not null default 0,
  currency text not null default 'RUB',
  leads_limit integer,
  messages_limit integer,
  channels_limit integer,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  plan_id text not null references plans(id),
  status text not null default 'active' check (status in ('active', 'trial', 'past_due', 'canceled')),
  provider text not null default 'mock',
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_subscriptions_workspace_user on subscriptions(workspace_id, user_id);
create index if not exists idx_subscriptions_plan on subscriptions(plan_id);

create table if not exists usage (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  metric text not null check (metric in ('leads', 'messages', 'channels')),
  period_key text not null,
  period_start date,
  period_end date,
  used_value integer not null default 0,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, metric, period_key)
);

create index if not exists idx_usage_workspace_user on usage(workspace_id, user_id);
create index if not exists idx_usage_metric_period on usage(metric, period_key);

insert into plans (
  id, title, description, price_monthly, currency, leads_limit, messages_limit, channels_limit, is_placeholder, updated_at
) values
  ('free', 'Free', 'Для старта и проверки ценности', 0, 'RUB', 100, 1000, 1, false, now()),
  ('pro', 'Pro', 'Для растущего бизнеса', 4900, 'RUB', 1000, 10000, 5, false, now()),
  ('enterprise', 'Enterprise', 'Индивидуальный план (заглушка)', 0, 'RUB', null, null, null, true, now())
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  currency = excluded.currency,
  leads_limit = excluded.leads_limit,
  messages_limit = excluded.messages_limit,
  channels_limit = excluded.channels_limit,
  is_placeholder = excluded.is_placeholder,
  updated_at = now();

commit;
