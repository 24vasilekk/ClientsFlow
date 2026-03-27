# CFlow Multichannel Architecture (Adapter Layer)

## 1) Proposed directory structure

```txt
api/
  inbound/
    telegram.ts          # webhook/poll endpoint -> processIncomingEvent
    instagram.ts
    whatsapp.ts
  outbound/
    send.ts              # optional manual/ops send endpoint

src/
  core/
    multichannel/
      types.ts           # shared canonical types (message/conversation/lead/event)
      adapter.ts         # ChannelAdapter contract
      registry.ts        # adapter lookup by channel
      pipeline.ts        # unified incoming pipeline
      adapters/
        telegramAdapter.ts
        instagramAdapter.ts
        whatsappAdapter.ts
        vkAdapter.ts
        emailAdapter.ts
      followup/
        scheduler.ts
      analytics/
        projector.ts
      ai/
        decisionEngine.ts
```

## 2) Canonical model

Single canonical model is used by all channels:

- `IncomingMessage`
- `OutgoingMessage`
- `Conversation`
- `Lead`
- `ChannelConnection`
- `ChannelEvent`

Any channel-specific payload must be normalized to this model inside adapter.

## 3) Unified flow

`incoming event -> normalize -> save -> AI decision -> send reply -> update analytics`

Detailed:

1. Channel endpoint receives raw provider payload.
2. Pipeline resolves `ChannelConnection` and adapter by `connection.channel`.
3. Adapter normalizes raw payload into one or many `IncomingMessage`.
4. Pipeline upserts `Conversation` and `Lead`.
5. Pipeline saves `message_incoming` event.
6. AI decision engine returns: reply/no-reply, stage update, score update.
7. If reply needed, adapter sends `OutgoingMessage`.
8. Pipeline writes `message_outgoing` or `delivery_failed`.
9. Analytics consumes every `ChannelEvent` and computes dashboards.

## 4) Extensibility rules (future channels)

To add a new channel:

1. Implement `ChannelAdapter`.
2. Register it in adapter registry.
3. Add connection settings UI for that channel.
4. Add inbound endpoint or worker that passes raw events to `processIncomingEvent`.

No changes needed in:

- AI decision logic contract
- analytics contract
- dashboard data model
- lead/conversation domain model

This keeps UI and product logic channel-agnostic.

