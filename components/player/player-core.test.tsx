import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { PlayerCore } from "./player-core";

function withStore() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
  }], 0);
  return store;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

describe("<PlayerCore>", () => {
  it("renders one <audio> and one <video>", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    expect(container.querySelectorAll("audio").length).toBe(1);
    expect(container.querySelectorAll("video").length).toBe(1);
  });

  it("sets src on the active element from /api/stream/<id>", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    expect(audio.getAttribute("src")).toMatch(/\/api\/stream\/42$/);
  });

  it("calls play() on the audio element when store.isPlaying flips true", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { store.getState().play(); });
    expect(audio.play).toHaveBeenCalled();
  });

  it("on element 'error' event triggers next() and toast", () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 99} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { audio.dispatchEvent(new Event("error")); });
    expect(store.getState().currentIndex).toBe(1);
  });

  it("ended event advances to next track", () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 11} /></PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { audio.dispatchEvent(new Event("ended")); });
    expect(store.getState().currentIndex).toBe(1);
  });

  it("keeps isPlaying when play() rejects with AbortError (src swap mid-play)", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new DOMException("interrupted by load", "AbortError")),
    );
    const store = withStore();
    render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    act(() => { store.getState().play(); });
    await act(async () => { await Promise.resolve(); });
    expect(store.getState().isPlaying).toBe(true);
  });

  it("pauses when play() rejects with a non-abort error (autoplay blocked)", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new DOMException("denied", "NotAllowedError")),
    );
    const store = withStore();
    render(
      <PlayerStoreProvider store={store}><PlayerCore resolveMediaFileId={() => 42} /></PlayerStoreProvider>,
    );
    act(() => { store.getState().play(); });
    await act(async () => { await Promise.resolve(); });
    expect(store.getState().isPlaying).toBe(false);
  });

  it("re-issues play() for the new src after auto-advance", () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    const { container } = render(
      <PlayerStoreProvider store={store}>
        <PlayerCore resolveMediaFileId={(videoId) => videoId * 10} />
      </PlayerStoreProvider>,
    );
    const audio = container.querySelector("audio")!;
    act(() => { store.getState().play(); });
    const callsBefore = vi.mocked(audio.play).mock.calls.length;
    act(() => { audio.dispatchEvent(new Event("ended")); });
    expect(audio.getAttribute("src")).toMatch(/\/api\/stream\/20$/);
    expect(vi.mocked(audio.play).mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
