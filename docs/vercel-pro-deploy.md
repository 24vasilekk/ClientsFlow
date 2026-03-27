# Vercel Pro Deploy Checklist (CFlow)

## 1. What runs on Vercel

- Frontend (Vite static build)
- API routes in `/api/*` (serverless functions)
- Scheduled dispatch via Vercel Cron:
  - `GET/POST /api/runtime/cron-dispatch` every 5 minutes

## 2. What must run outside Vercel

- PostgreSQL/Auth: Supabase (required)
- AI provider: OpenRouter (required for live AI responses)
- External channels/webhooks:
  - Telegram API
  - Instagram Graph API
  - VK API
  - Optional CRM webhook target

## 3. Required Vercel env vars

Core:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL` (your deployed domain, e.g. `https://your-app.vercel.app`)
- `CRON_SECRET`
- `CFLOW_ALLOW_DEMO_CONTEXT=false`
- `CFLOW_ALLOW_DEV_AUTH_BYPASS=false`

AI:

- `OPENROUTER_API_KEY`
- `OPENROUTER_SITE_URL` (same public domain)

Automation/runtime:

- `CFLOW_ENABLE_DEFERRED_DISPATCH=true`
- `CFLOW_INTERNAL_DISPATCH_TOKEN` (optional; if empty, `CRON_SECRET` is used)

Channels / integrations (if used):

- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`
- `VK_CONFIRMATION_TOKEN`
- `CRM_WEBHOOK_URL`
- `CRM_WEBHOOK_TOKEN`
- `CHANNEL_TOKEN_SECRET` (recommended for production)

Billing prep (mock/stripe stub):

- `BILLING_PROVIDER=mock`
- `STRIPE_SECRET_KEY` (optional for future real integration)
- `STRIPE_WEBHOOK_SECRET` (optional for future real integration)

## 4. DB migration step (required before first production traffic)

Run all SQL files from:

- `db/migrations/001_multichannel_core.sql`
- ...
- `db/migrations/015_enqueue_insert_if_new.sql`

Without migrations the app can deploy but business flows will fail at runtime.

## 5. Post-deploy smoke tests

1. Auth:
   - signup/login/session works
2. Dashboard:
   - `/api/dashboard/read-model` and `/api/analytics/metrics` return data (or honest empty states)
3. Ingestion:
   - `POST /api/ingest/events` stores `raw + normalized` without duplicates for same idempotency key
4. Follow-up:
   - enqueue creates one job per dedup key; dispatch does not double-send
5. CRM handoff:
   - pending -> claimed -> processing -> success/retry/failed transitions are visible
6. Cron:
   - `/api/runtime/cron-dispatch` responds `200` with internal auth token

## 6. Notes for Vercel Pro runtime

- Current `vercel.json` already sets `maxDuration` for heavy handlers (`ingest`, `ops`, `followup`, `crm`, `sites`, cron).
- Pro plan is sufficient for this architecture.
- Keep heavy work in deferred/dispatch flows (`/api/runtime/cron-dispatch`) instead of long synchronous UI requests.
