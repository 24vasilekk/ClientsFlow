# CFlow Roadmap: Demo -> Multi-channel SaaS (Free-tier Friendly)

## Stack baseline (free-tier friendly)
- DB: Supabase Postgres (или Neon Postgres) + SQL migrations
- API: Vercel serverless routes (с лимитом, позже consolidation)
- Scheduler: Local dispatch cron + optional Upstash QStash free tier
- AI: OpenRouter (provider abstraction + fallback rules)
- Storage of secrets: env + connection manager (без hardcoded tokens)

---

## Stage 1. Server PostgreSQL hardening
### Scope
- Убрать риск потери данных при автосохранении состояния UI
- Сделать статусы server operations честными (без fake success)

### Done
- `api/data/state.ts`: очистка данных (`clearWorkspaceData`) теперь только при явном `replaceAll: true`
- `api/data/state.ts`: `conversation.connection_id` формируется по фактическому каналу (`cc_<workspace>_<user>_<channel>`)
- `api/ops/actions.ts`: `followup_start` возвращает статус по фактическому `runStatus` (`success | incomplete | failed`)

### Реально работает
- Автосохранение состояния больше не стирает все лиды/сообщения по умолчанию
- Follow-up action больше не маскирует ошибку под успех

### Еще мок / ограничения
- `api/data/state` остается bridge-слоем между UI state и БД
- Есть demo defaults (`demo-workspace/demo-user`) в нескольких API

### Next
- Stage 2: Unified Event Model as source-of-truth (минимизировать зависимость аналитики/UI от state bridge)

---

## Stage 2. Unified event model (source-of-truth)
### Scope
- Финализировать `ingestion_events` как центральный журнал событий
- Считать бизнес-состояние из событий и сущностей БД, а не из UI snapshots

### Done (current iteration)
- `api/data/state.ts` (POST) больше не апсертит `leads/conversations/messages/crm_handoffs` из `serviceEvents`
- Dashboard перестал отправлять `serviceEvents` в `/api/data/state` при autosave
- `api/data/state.ts` (GET) отдает server-side `readModel`:
  - `leads`
  - `conversations`
  - `messages`
  - `channelHealth`
  - `analyticsSummary`
- Добавлен dedicated read model endpoint: `/api/dashboard/read-model`
- Добавлен query layer: `api/dashboard/readModelQueries.ts` (server-side selectors/aggregates)
- Dashboard читает `conversationPreviews`, `leads`, `recentMessages`, `connectionHealth` из server read model

### Exit criteria
- Incoming/lead/message lifecycle читается и воспроизводится серверно
- UI не требует “перезаливки” массива serviceEvents для правды

---

## Stage 3. Channel adapter architecture
### Scope
- Привести Telegram/Instagram/VK/custom_webhook к единому adapter contract
- Отвязать бизнес-логику AI/analytics от channel-specific полей

### Exit criteria
- Любой новый канал подключается через adapter + config + route

---

## Stage 4. Follow-up engine (free scheduler)
### Scope
- QStash/local provider abstraction, retries/cancel/dedup
- Канально-независимая отправка follow-up (не только Telegram)

### Exit criteria
- Follow-up jobs исполняются через adapter layer для активного канала

---

## Stage 5. Universal CRM webhook handoff
### Scope
- Надежный outbound webhook handoff + retry/backoff + attempt logs
- Явные статусы pending/success/failed в UI

### Exit criteria
- Квалифицированный лид стабильно уходит в внешний endpoint

---

## Stage 6. Honest analytics from DB events
### Scope
- Метрики только из real events + entities в БД
- Обработка empty/no-data периодов без поломок UI

### Exit criteria
- Нет захардкоженных KPI в боевых экранах

---

## Stage 7. Instagram adapter hardening
### Scope
- Webhook ingest + outgoing reply + connection validation
- Убрать dev-only token path (через manager/secret strategy)

---

## Stage 8. VK adapter hardening
### Scope
- Webhook/long-poll ingestion compatibility
- Outgoing reply + error/re-auth lifecycle

---

## Stage 9. Generic adapter template
### Scope
- Шаблоны для future channels (Max, Avito, widget, custom source)
- Документация “1 file + 1 config + 1 route”

---

## Stage 10. Remove fake-actions + fake success states
### Scope
- Все UI actions -> реальный backend handler
- Для незавершенных функций только `incomplete`, без имитации успеха

### Exit criteria
- UI не вводит в заблуждение: каждое действие имеет честный outcome
