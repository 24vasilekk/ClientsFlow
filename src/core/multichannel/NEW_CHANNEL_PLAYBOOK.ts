/**
 * NEW CHANNEL PLAYBOOK (1 file + 1 config + 1 route)
 *
 * 1) One adapter file
 * - Create `src/core/multichannel/adapters/<channel>Adapter.ts`
 * - Extend `GenericChannelAdapter`
 * - Implement required methods:
 *   - validateConnection
 *   - mapIncoming
 *   - mapOutgoing
 *   - sendMessage (override when provider has custom protocol)
 *   - refreshConnection (optional override; default no-op)
 *
 * 2) One config
 * - Register constructor in `createAdaptersByConfig(...)`
 * - Or inject custom config from bootstrap.
 *
 * 3) One route
 * - Add `api/<channel>/index.ts`
 * - Route responsibilities:
 *   - upsert connection metadata in `channel_connections`
 *   - receive webhook / long-poll event
 *   - forward raw payload to `POST /api/ingest/events` with `channel=<channel>`
 *
 * Result:
 * - Business logic remains channel-agnostic.
 * - UI/analytics/AI continue to operate on common internal schema.
 */
export const NEW_CHANNEL_PLAYBOOK_VERSION = "1.0.0";

