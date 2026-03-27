-- Workspace team invites and membership management

create table if not exists workspace_invites (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null,
  status text not null default 'pending',
  invite_token text not null unique,
  invited_by_user_id text not null,
  accepted_by_user_id text null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  canceled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('owner', 'admin', 'member')),
  check (status in ('pending', 'accepted', 'revoked', 'expired', 'canceled'))
);

create index if not exists idx_workspace_invites_workspace_status
  on workspace_invites(workspace_id, status, created_at desc);

create index if not exists idx_workspace_invites_email
  on workspace_invites(email);

