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

  it("formats current time and duration into separate spans", () => {
    const store = withStore(); loadOne(store);
    act(() => { store.getState().setPosition(75); });
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("3:20")).toBeInTheDocument();
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

  it("clicking the seek slider seeks", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const slider = screen.getByRole("slider", { name: /seek/i });
    Object.defineProperty(slider, "getBoundingClientRect", { value: () => ({ left: 0, width: 100, top: 0, right: 100, bottom: 6, height: 6 }) });
    await userEvent.pointer({ keys: "[MouseLeft>]", target: slider, coords: { x: 50, y: 3 } });
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

  it("queue button opens queue when mode is not queue-open", async () => {
    const store = withStore(); loadOne(store);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const btn = screen.getByRole("button", { name: /open queue/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(store.getState().mode).toBe("queue-open");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("queue button closes queue when mode is queue-open", async () => {
    const store = withStore(); loadOne(store);
    store.getState().openQueue();
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    const btn = screen.getByRole("button", { name: /open queue/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(btn);
    expect(store.getState().mode).toBe("mini");
  });

  it("artwork button calls openFullscreen when track has thumbnailUrl", async () => {
    const store = withStore();
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "Hello",
      channelTitle: "Chan", thumbnailUrl: "https://example.com/thumb.jpg",
      durationSeconds: 200, availableKinds: ["audio"],
    }], 0);
    store.getState().setDuration(200);
    render(<PlayerStoreProvider store={store}><PlayerBar /></PlayerStoreProvider>);
    // There are two "Open fullscreen" buttons: artwork (left) and icon (right)
    const buttons = screen.getAllByRole("button", { name: /open fullscreen/i });
    expect(buttons).toHaveLength(2);
    // Click the artwork button (first one, in left cluster)
    await userEvent.click(buttons[0]!);
    expect(store.getState().mode).toBe("fullscreen");
  });
});
