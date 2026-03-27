import type {
  AdapterContext,
  ChannelConnection,
  ChannelType,
  DeliveryResult,
  IncomingMessage,
  OutgoingMessage
} from "./types";

export type AdapterHealth = {
  ok: boolean;
  details?: string;
};

export type OutgoingProviderPayload = {
  endpoint: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

export interface ChannelAdapter {
  readonly channel: ChannelType;

  validateConnection(connection: ChannelConnection): Promise<AdapterHealth>;

  ingestEvent(
    rawEvent: unknown,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<IncomingMessage[]>;

  mapIncoming(
    rawEvent: unknown,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<IncomingMessage[]>;

  mapOutgoing(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<OutgoingProviderPayload>;

  sendMessage(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<DeliveryResult>;

  refreshConnection(
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<{
    connection: ChannelConnection;
    reauthRequired?: boolean;
    details?: string;
  }>;
}
