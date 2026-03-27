import type {
  AdapterHealth,
  ChannelAdapter,
  OutgoingProviderPayload
} from "./adapter";
import type {
  AdapterContext,
  ChannelConnection,
  DeliveryResult,
  IncomingMessage,
  OutgoingMessage
} from "./types";

/**
 * GenericChannelAdapter
 *
 * Plug-in recipe (channel-first, fast onboarding):
 * 1) Create one adapter file extending this class.
 * 2) Register adapter in `createDefaultAdapterRegistry` (one config touchpoint).
 * 3) Add one route (`api/<channel>/index.ts`) forwarding raw events to `/api/ingest/events`.
 */
export abstract class GenericChannelAdapter implements ChannelAdapter {
  abstract readonly channel: ChannelConnection["channel"];

  abstract validateConnection(connection: ChannelConnection): Promise<AdapterHealth>;

  abstract mapIncoming(
    rawEvent: unknown,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<IncomingMessage[]>;

  abstract mapOutgoing(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<OutgoingProviderPayload>;

  async ingestEvent(
    rawEvent: unknown,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<IncomingMessage[]> {
    return this.mapIncoming(rawEvent, connection, ctx);
  }

  async sendMessage(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<DeliveryResult> {
    const mapped = await this.mapOutgoing(outgoing, connection, ctx);
    const response = await fetch(mapped.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mapped.headers || {})
      },
      body: JSON.stringify(mapped.body)
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        errorCode: "provider_http_error",
        errorMessage: JSON.stringify(payload).slice(0, 300) || `status_${response.status}`
      };
    }
    return { ok: true, providerStatus: "sent" };
  }

  async refreshConnection(
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<{
    connection: ChannelConnection;
    reauthRequired?: boolean;
    details?: string;
  }> {
    return { connection, reauthRequired: false };
  }
}

