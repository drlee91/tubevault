import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobilePlayerSheet } from "./mobile-sheet";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function loadAudio() {
  const store = createPlayerStore();
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Mobile", channelTitle: "Chan",
    thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
  }], 0);
  return store;
}

describe("<MobilePlayerSheet>", () => {
  it("renders nothing when idle", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows mini bar with title + play/pause", () => {
    const store = loadAudio();
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("tap on mini bar opens fullscreen sheet", async () => {
    const store = loadAudio();
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /open player/i }));
    expect(store.getState().mode).toBe("fullscreen");
  });

  it("renders FullscreenAudio in the sheet for audio kind", () => {
    const store = loadAudio();
    act(() => { store.getState().openFullscreen(); });
    render(<PlayerStoreProvider store={store}><MobilePlayerSheet /></PlayerStoreProvider>);
    expect(screen.getAllByText("Mobile").length).toBeGreaterThan(0);
  });
});
