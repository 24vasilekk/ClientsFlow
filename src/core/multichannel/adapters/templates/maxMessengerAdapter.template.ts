import { GenericChannelAdapter } from "../../baseAdapter";
import type { OutgoingProviderPayload } from "../../adapter";
import type { AdapterContext, ChannelConnection, DeliveryResult, IncomingMessage, OutgoingMessage } from "../../types";

/**
 * Template: Max Messenger adapter
 *
 * Copy file -> rename -> implement TODOs.
 * Then:
 * 1) register in adapterFactory config
 * 2) add API route `api/max/index.ts` forwarding to `/api/ingest/events`
 */
export class MaxMessengerAdapterTemplate extends GenericChannelAdapter {
  readonly channel = "max" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    // TODO: validate credentials metadata
    return { ok: Boolean(connection.credentialsRef), details: connection.credentialsRef ? undefined : "missing credentialsRef" };
  }

  async mapIncoming(_rawEvent: unknown, _connection: ChannelConnection, _ctx: AdapterContext): Promise<IncomingMessage[]> {
    // TODO: map provider payload -> IncomingMessage[]
    return [];
  }

  async mapOutgoing(outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<OutgoingProviderPayload> {
    // TODO: map OutgoingMessage -> provider payload
    return {
      endpoint: "https://api.max.example/messages/send",
      body: { text: outgoing.text, to: outgoing.recipientExternalId }
    };
  }

  async sendMessage(_outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<DeliveryResult> {
    // TODO: optionally override if provider requires custom response parsing
    return { ok: false, errorCode: "not_implemented", errorMessage: "Template only" };
  }
}

