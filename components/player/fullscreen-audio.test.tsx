import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FullscreenAudio } from "./fullscreen-audio";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function setup() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Hello", channelTitle: "Chan",
    thumbnailUrl: null, durationSeconds: 200, availableKinds: ["audio"],
  }], 0);
  store.getState().setDuration(200);
  store.getState().openFullscreen();
  return store;
}

describe("<FullscreenAudio>", () => {
  it("renders nothing when mode is mini", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title + channel when fullscreen", () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Chan")).toBeInTheDocument();
  });

  it("Close button returns to mini mode", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(store.getState().mode).toBe("mini");
  });

  it("Esc key closes fullscreen", () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(store.getState().mode).toBe("mini");
  });

  it("Queue tab switches to QueueList", async () => {
    const store = setup();
    render(<PlayerStoreProvider store={store}><FullscreenAudio /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("tab", { name: /queue/i }));
    expect(screen.getByText(/Queue · 1 tracks/i)).toBeInTheDocument();
  });
});
