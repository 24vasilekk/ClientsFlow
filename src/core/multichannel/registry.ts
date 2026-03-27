import type { ChannelAdapter } from "./adapter";
import type { ChannelType } from "./types";

export class InMemoryAdapterRegistry {
  private readonly adapters = new Map<ChannelType, ChannelAdapter>();

  register(adapter: ChannelAdapter): this {
    this.adapters.set(adapter.channel, adapter);
    return this;
  }

  resolve(channel: ChannelType): ChannelAdapter | null {
    return this.adapters.get(channel) || null;
  }

  listChannels(): ChannelType[] {
    return [...this.adapters.keys()];
  }
}

