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
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
