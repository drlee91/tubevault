import type { MediaProviderAdapter, ProviderId } from "./types";

export class ProviderRegistry {
  private adapters = new Map<ProviderId, MediaProviderAdapter>();

  register(adapter: MediaProviderAdapter): void {
    if (this.adapters.has(adapter.provider)) {
      throw new Error(`provider ${adapter.provider} already registered`);
    }
    this.adapters.set(adapter.provider, adapter);
  }

  unregister(id: ProviderId): boolean {
    return this.adapters.delete(id);
  }

  findById(id: ProviderId): MediaProviderAdapter | null {
    return this.adapters.get(id) ?? null;
  }

  findByUrl(url: string): MediaProviderAdapter | null {
    for (const a of this.adapters.values()) if (a.matchesUrl(url)) return a;
    return null;
  }

  list(): MediaProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
