# DB setup (Supabase Postgres / Neon Postgres)

## 1. Run migrations

Execute SQL from:

- `db/migrations/001_multichannel_core.sql`
- `db/migrations/002_ingestion_events.sql`
- `db/migrations/003_follow_up_engine.sql`
- `db/migrations/004_crm_webhook_handoff.sql`
- `db/migrations/005_ai_decision_logs.sql`
- `db/migrations/006_channel_connection_manager.sql`
- `db/migrations/007_workspace_model.sql`
- `db/migrations/008_follow_up_atomic_claim.sql`
- `db/migrations/009_follow_up_lifecycle_statuses.sql`
- `db/migrations/010_crm_handoff_lifecycle.sql`
- `db/migrations/011_workspace_invites.sql`
- `db/migrations/012_billing_mock.sql`
- `db/migrations/013_usage_tracking_metrics.sql`
- `db/migrations/014_billing_invoices.sql`
- `db/migrations/015_enqueue_insert_if_new.sql`

in your PostgreSQL database (Supabase SQL editor or `psql`).

## 2. Required env

Set server env variables:

- `SUPABASE_URL` (project URL, no trailing slash)
- `SUPABASE_SERVICE_ROLE_KEY` (service key, server-only)
- `APP_BASE_URL` (public base URL of deployed app, e.g. `https://your-app.vercel.app`)
- `CRON_SECRET` (required for internal cron/dispatch auth)

Optional/feature env:

- `OPENROUTER_API_KEY` (live AI mode)
- `CFLOW_INTERNAL_DISPATCH_TOKEN` (if empty, `CRON_SECRET` is used)
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `VK_CONFIRMATION_TOKEN`
- `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_TOKEN`
- `CHANNEL_TOKEN_SECRET` (recommended for production token storage)

## 3. Notes

- Storage is multi-tenant via `workspace_id` + `user_id`.
- Dashboard/business data comes from server read model + analytics API.
- `localStorage` should be kept only for lightweight client preferences (visual toggles, local draft UX data).
- Unified ingestion endpoint: `POST /api/ingest/events` (raw+normalized logging, idempotency, trace id).
- Instagram adapter/webhook:
  - `GET/POST /api/instagram` (verify webhook, upsert connection metadata, forward inbound to unified ingestion, send reply abstraction).
- VK adapter/webhook:
  - `POST /api/vk` (upsert connection metadata, webhook/long-poll ingestion forwarding, send reply abstraction).
  - UI-ready connection states supported in API: `connected`, `error`, `needs_reauth`, `disabled`.
- CRM handoff (generic outbound webhook):
  - enqueue from unified ingestion when lead is qualified
  - dispatch/retry endpoint: `POST /api/crm/handoff`
  - lifecycle statuses: `pending`, `claimed`, `processing`, `success`, `retry_scheduled`, `failed`, `canceled`
  - attempts log table: `crm_handoff_attempts`
- Follow-up engine:
  - schedule on inbound events: `api/ingest/events -> follow_up_jobs`
  - execute single job: `POST /api/followup/execute`
  - dispatch due jobs (for local/cron mode): `POST /api/followup/dispatch`
  - lifecycle statuses: `pending`, `claimed`, `processing`, `sent`, `retry_scheduled`, `canceled`, `recovered`, `failed`
- Unified AI decision pipeline:
  - endpoint: `POST /api/ai/decision`
  - auto-reply integration: `api/ingest/events` (for text events, channel-aware send)
  - logs table: `ai_decision_logs` (prompt/input/output metadata, provider, model, errors)
- Channel connection manager:
  - endpoint: `GET/POST /api/channel-connections`
  - lifecycle actions: `connect`, `validate`, `reconnect`, `disable`, `health-check`
  - unified storage: `channel_connections` (+ manager columns from migration `006`)
  - UI/admin receives honest status + health + sync counters + last error
- Custom inbound webhook adapter:
  - endpoint: `POST /api/custom-webhook`
  - supports auth modes: `none`, `token`, `signature`
  - supports payload mapping (`parsePath`) -> normalized internal event -> unified ingestion
  - outbound reply modes: `callback` or `manual_only`
  - channel type: `custom_webhook` (later can be upgraded to native adapter)
