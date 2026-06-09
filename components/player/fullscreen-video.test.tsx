import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FullscreenVideo } from "./fullscreen-video";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function setup() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "video", title: "Clip", channelTitle: null,
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["video"],
  }], 0);
  store.getState().openFullscreen();
  return store;
}

describe("<FullscreenVideo>", () => {
  it("renders nothing when mode is mini", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for audio kind", () => {
    const store = createPlayerStore();
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
      thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
    }], 0);
    store.getState().openFullscreen();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("Close button returns to mini mode", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenVideo /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(store.getState().mode).toBe("mini");
  });

  it("Expand button calls requestFullscreen on the video element", async () => {
    const store = setup();
    const spy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, "requestFullscreen", { value: spy, configurable: true });
    // FullscreenVideo no longer renders the <video> itself — PlayerCore does.
    // Mount a sibling with src= so the document.querySelector("video[src]")
    // lookup in expandNative() finds a real target.
    render(
      <PlayerStoreProvider store={store}>
        <video src="blob:test" />
        <FullscreenVideo />
      </PlayerStoreProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /expand/i }));
    expect(spy).toHaveBeenCalled();
  });
});
