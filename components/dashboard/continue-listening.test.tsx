import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContinueListening } from "./continue-listening";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { STORAGE_KEY } from "@/lib/player/persist";
import type { QueueItem } from "@/lib/player/types";
import type { PersistedSlice } from "@/lib/player/persist";

const item1: QueueItem = {
  videoId: 1,
  defaultKind: "audio",
  title: "First Track",
  channelTitle: "Channel A",
  thumbnailUrl: null,
  durationSeconds: 180,
  availableKinds: ["audio"],
};

const item2: QueueItem = {
  videoId: 2,
  defaultKind: "audio",
  title: "Second Track",
  channelTitle: "Channel B",
  thumbnailUrl: null,
  durationSeconds: 240,
  availableKinds: ["audio"],
};

function makeSlice(overrides?: Partial<PersistedSlice>): PersistedSlice {
  return {
    queue: [item1, item2],
    currentIndex: 0,
    position: 42,
    volume: 1,
    shuffle: false,
    repeat: "off",
    ...overrides,
  };
}

function renderWithStore() {
  const store = createPlayerStore();
  const result = render(
    <PlayerStoreProvider store={store}>
      <ContinueListening />
    </PlayerStoreProvider>,
  );
  return { store, ...result };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("<ContinueListening>", () => {
  it("renders nothing when localStorage is empty", () => {
    const { container } = renderWithStore();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when localStorage is corrupted JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{");
    const { container } = renderWithStore();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when queue is empty", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue: [], currentIndex: 0, position: 0, volume: 1, shuffle: false, repeat: "off" }));
    const { container } = renderWithStore();
    expect(container.firstChild).toBeNull();
  });

  it("renders both cards from a valid persisted payload", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSlice()));
    renderWithStore();
    expect(await screen.findByText("First Track")).toBeInTheDocument();
    expect(screen.getByText("Second Track")).toBeInTheDocument();
  });

  it("current card shows 'bei 0:42' (Duration of position)", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSlice()));
    renderWithStore();
    // The current card (index 0) should show "bei" followed by Duration of 42s
    expect(await screen.findByText(/bei/)).toBeInTheDocument();
    expect(screen.getByText("0:42")).toBeInTheDocument();
  });

  it("second card shows full duration of item2 (4:00)", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSlice()));
    renderWithStore();
    await screen.findByText("Second Track");
    expect(screen.getByText("4:00")).toBeInTheDocument();
  });

  it("clicking the second card sets queue to index 1 and isPlaying becomes true", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSlice()));
    const { store } = renderWithStore();
    const secondCard = await screen.findByRole("button", { name: /Second Track/i });
    // The button accessible name comes from the title text inside it
    // use a more targeted approach: find by text proximity
    const buttons = screen.getAllByRole("button");
    // buttons[0] = current (First Track), buttons[1] = Second Track
    expect(buttons).toHaveLength(2);
    await act(async () => {
      await userEvent.click(buttons[1]!);
    });
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().isPlaying).toBe(true);
  });

  it("clicking the current card resumes at slice.position (seek token bumps, position set)", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSlice()));
    const { store } = renderWithStore();
    const buttons = await screen.findAllByRole("button");
    const prevSeekToken = store.getState().seekToken;
    await act(async () => {
      await userEvent.click(buttons[0]!);
    });
    // seek() bumps seekToken
    expect(store.getState().seekToken).toBeGreaterThan(prevSeekToken);
    // position should be 42 (the persisted position)
    expect(store.getState().position).toBe(42);
    expect(store.getState().isPlaying).toBe(true);
  });
});
