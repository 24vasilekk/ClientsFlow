begin;

create table if not exists invoices (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  subscription_id text references subscriptions(id) on delete set null,
  plan_id text not null references plans(id),
  provider text not null default 'mock',
  provider_invoice_id text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'RUB',
  status text not null default 'paid' check (status in ('draft', 'open', 'paid', 'void', 'failed')),
  period_start date,
  period_end date,
  issued_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_workspace_user_created on invoices(workspace_id, user_id, created_at desc);
create index if not exists idx_invoices_subscription on invoices(subscription_id);
create index if not exists idx_invoices_status on invoices(status);

commit;
