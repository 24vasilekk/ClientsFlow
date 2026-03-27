import { InMemoryAdapterRegistry } from "./registry";
import { createAdaptersByConfig } from "./adapterFactory";

export function createDefaultAdapterRegistry() {
  const registry = new InMemoryAdapterRegistry();
  const adapters = createAdaptersByConfig();
  for (const adapter of adapters) registry.register(adapter);
  return registry;
}
