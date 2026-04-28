import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "./registry";
import type { MediaProviderAdapter } from "./types";

function fake(provider: "youtube", host: string): MediaProviderAdapter {
  return {
    provider,
    matchesUrl: (u) => u.includes(host),
    parseUrl: () => null,
    fetchPlaylist: async () => { throw new Error("not used"); },
    fetchVideo: async () => { throw new Error("not used"); },
    download: async () => { throw new Error("not used"); },
    checkAvailability: async () => { throw new Error("not used"); },
  };
}

describe("ProviderRegistry", () => {
  it("registers and looks up by id", () => {
    const r = new ProviderRegistry();
    const yt = fake("youtube", "youtube.com");
    r.register(yt);
    expect(r.findById("youtube")).toBe(yt);
  });
  it("looks up by URL via matchesUrl", () => {
    const r = new ProviderRegistry();
    const yt = fake("youtube", "youtube.com");
    r.register(yt);
    expect(r.findByUrl("https://www.youtube.com/x")).toBe(yt);
    expect(r.findByUrl("https://other.tld/")).toBeNull();
  });
  it("rejects duplicate provider ids", () => {
    const r = new ProviderRegistry();
    r.register(fake("youtube", "a"));
    expect(() => r.register(fake("youtube", "b"))).toThrow(/already registered/);
  });
  it("unregister removes the adapter and reports it", () => {
    const r = new ProviderRegistry();
    r.register(fake("youtube", "youtube.com"));
    expect(r.unregister("youtube")).toBe(true);
    expect(r.findById("youtube")).toBeNull();
    expect(r.unregister("youtube")).toBe(false);
  });
  it("re-register works after unregister", () => {
    const r = new ProviderRegistry();
    r.register(fake("youtube", "a"));
    r.unregister("youtube");
    const replacement = fake("youtube", "b");
    r.register(replacement);
    expect(r.findById("youtube")).toBe(replacement);
  });
});
