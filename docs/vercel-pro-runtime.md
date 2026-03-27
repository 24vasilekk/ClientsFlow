# Vercel Pro Runtime Notes

## Runtime path principles
- Keep ingestion and user-facing API paths short.
- Move heavy dispatch loops to deferred/internal execution.
- Use DB-first enqueue and process jobs in dispatch endpoints.

## What is configured
- `vercel.json` includes raised `maxDuration` for heavy routes:
  - `api/ingest/events.ts`
  - `api/ops/actions.ts`
  - `api/sites/generate.ts`
  - `api/followup/dispatch.ts`
  - `api/crm/handoff.ts`
  - `api/runtime/cron-dispatch.ts`
  - and analytics/read-model/openrouter routes.
- Cron is configured:
  - `*/5 * * * *` -> `/api/runtime/cron-dispatch`

## Deferred/background execution path
- `api/ops/actions.ts` supports deferred CRM dispatch via internal call:
  - Uses `CFLOW_ENABLE_DEFERRED_DISPATCH=true`.
  - Enqueues internal call to `/api/crm/handoff` instead of running heavy dispatch synchronously.
- `api/runtime/cron-dispatch.ts` processes follow-up + CRM dispatch across active workspaces.

## Internal auth
- Internal routes accept bearer token from:
  - `CFLOW_INTERNAL_DISPATCH_TOKEN`
  - or fallback `CRON_SECRET`
- Vercel Cron uses `Authorization: Bearer <CRON_SECRET>`.

## Region/runtime notes
- Deploy API functions in a region close to your Postgres/Supabase region to reduce latency.
- Keep `APP_BASE_URL` set to the public production URL for internal deferred calls.
- If AI routes are slow, keep them isolated from critical write paths and use retry/fallback policies already implemented in providers.

## Remaining heavy routes to monitor
- `api/sites/generate.ts` (LLM orchestration).
- `api/ingest/events.ts` under burst webhook load.
- `api/analytics/metrics.ts` and `api/dashboard/read-model.ts` on large workspaces.
- `api/runtime/cron-dispatch.ts` if workspace count grows significantly.

