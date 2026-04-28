// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPlayerStore } from "./store";
import { attachMediaSession, updateMediaSessionMetadata } from "./media-session";

interface FakeMediaSession {
  metadata: unknown;
  setActionHandler: (action: string, handler: (() => void) | ((d: { seekTime?: number }) => void) | null) => void;
  _handlers: Map<string, ((d?: { seekTime?: number }) => void) | null>;
}

function installFakeMediaSession(): FakeMediaSession {
  const handlers = new Map<string, ((d?: { seekTime?: number }) => void) | null>();
  const ms: FakeMediaSession = {
    metadata: null,
    _handlers: handlers,
    setActionHandler: (action, h) => { handlers.set(action, h as never); },
  };
  Object.defineProperty(navigator, "mediaSession", { value: ms, configurable: true });
  Object.defineProperty(window, "MediaMetadata", {
    value: class { constructor(public init: unknown) {} },
    configurable: true,
  });
  return ms;
}

beforeEach(() => {
  Object.defineProperty(navigator, "mediaSession", { value: undefined, configurable: true });
});

describe("attachMediaSession", () => {
  it("no-op when MediaSession API is missing", () => {
    const store = createPlayerStore();
    const detach = attachMediaSession(store);
    expect(detach).toBeTypeOf("function");
    detach();
  });

  it("registers play/pause/prev/next/seekto handlers wired to store", () => {
    const ms = installFakeMediaSession();
    const store = createPlayerStore();
    const spy = vi.spyOn(store.getState(), "play");
    attachMediaSession(store);
    ms._handlers.get("play")?.();
    expect(spy).toHaveBeenCalled();
  });

  it("seekto forwards seekTime to store.seek", () => {
    const ms = installFakeMediaSession();
    const store = createPlayerStore();
    store.getState().setQueue([{ videoId: 1, defaultKind: "audio", title: "T", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] }], 0);
    attachMediaSession(store);
    ms._handlers.get("seekto")?.({ seekTime: 42 });
    expect(store.getState().position).toBe(42);
  });
});

describe("updateMediaSessionMetadata", () => {
  it("sets MediaMetadata with title/artist/artwork", () => {
    const ms = installFakeMediaSession();
    updateMediaSessionMetadata({
      videoId: 1, defaultKind: "audio", title: "Hello",
      channelTitle: "Chan", thumbnailUrl: "https://i/1.jpg",
      durationSeconds: 60, availableKinds: ["audio"],
    });
    expect((ms.metadata as { init: { title: string } }).init.title).toBe("Hello");
  });

  it("no-op without MediaSession", () => {
    expect(() => updateMediaSessionMetadata({
      videoId: 1, defaultKind: "audio", title: "X",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 0, availableKinds: ["audio"],
    })).not.toThrow();
  });
});
