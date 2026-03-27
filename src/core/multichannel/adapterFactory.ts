import type { ChannelAdapter } from "./adapter";
import { InstagramAdapter } from "./adapters/instagramAdapter";
import { TelegramAdapter } from "./adapters/telegramAdapter";
import { VkAdapter } from "./adapters/vkAdapter";

type AdapterCtor = new () => ChannelAdapter;

export type AdapterFactoryConfig = {
  telegram?: AdapterCtor;
  instagram?: AdapterCtor;
  vk?: AdapterCtor;
  [channel: string]: AdapterCtor | undefined;
};

/**
 * createAdaptersByConfig
 *
 * Minimal setup for a new channel:
 * 1) Add one adapter file implementing `GenericChannelAdapter`.
 * 2) Register constructor in this config map.
 * 3) Add one API route that forwards raw events to `/api/ingest/events`.
 */
export function createAdaptersByConfig(config: AdapterFactoryConfig = {}): ChannelAdapter[] {
  const merged: AdapterFactoryConfig = {
    telegram: TelegramAdapter,
    instagram: InstagramAdapter,
    vk: VkAdapter,
    ...config
  };

  const adapters: ChannelAdapter[] = [];
  for (const ctor of Object.values(merged)) {
    if (!ctor) continue;
    adapters.push(new ctor());
  }
  return adapters;
}

