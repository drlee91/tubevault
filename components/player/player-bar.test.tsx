import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerBar } from "./player-bar";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function withStore() {
  const store = createPlayerStore();
  return store;
}

function loadOne(store: ReturnType<typeof createPlayerStore>) {
  store.getState().setQueue([{
    videoId: 1, defaultKind: "audio", title: "Hello",
    channelTitle: "Chan", thumbnailUrl: null, durationSeconds: 200,
    availableKinds: ["audio"],
  }], 0);
  store.getState().setDuration(200);
}

describe("<PlayerBar>", () => {
  it("renders nothing when idle (currentIndex -1)", () => {
    const store = withStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title + channel when track loaded", () => {
    const store = withStore();
    loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Chan")).toBeInTheDocument();
  });

  it("Play/Pause button toggles store.isPlaying", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(store.getState().isPlaying).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(store.getState().isPlaying).toBe(false);
  });

  it("formats time as M:SS / M:SS", () => {
    const store = withStore(); loadOne(store);
    act(() => { store.getState().setPosition(75); });
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    expect(screen.getByText("1:15 / 3:20")).toBeInTheDocument();
  });

  it("Next button calls store.next()", async () => {
    const store = withStore();
    store.getState().setQueue([
      { videoId: 1, defaultKind: "audio", title: "A", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
      { videoId: 2, defaultKind: "audio", title: "B", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    ], 0);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /next track/i }));
    expect(store.getState().currentIndex).toBe(1);
  });

  it("clicking the progress stripe seeks", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const stripe = screen.getByRole("slider", { name: /seek/i });
    Object.defineProperty(stripe, "getBoundingClientRect", { value: () => ({ left: 0, width: 100, top: 0, right: 100, bottom: 2, height: 2 }) });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: stripe, coords: { x: 50, y: 1 } });
    expect(store.getState().position).toBeCloseTo(100, 0);
  });

  it("Repeat button cycles label off → all → one", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const btn = screen.getByRole("button", { name: /repeat/i });
    await userEvent.click(btn);
    expect(store.getState().repeat).toBe("all");
    await userEvent.click(btn);
    expect(store.getState().repeat).toBe("one");
  });
});
