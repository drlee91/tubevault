import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueuePanel } from "./queue-panel";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function makeStore() {
  return createPlayerStore();
}

function loadOne(store: ReturnType<typeof makeStore>) {
  store.getState().setQueue(
    [
      {
        videoId: 1,
        defaultKind: "audio",
        title: "Test Track",
        channelTitle: "Test Channel",
        thumbnailUrl: null,
        durationSeconds: 120,
        availableKinds: ["audio"],
      },
    ],
    0,
  );
}

describe("<QueuePanel>", () => {
  it("renders nothing when mode is not queue-open (e.g. mini)", () => {
    const store = makeStore();
    // mode starts as "mini" (idle store has no item but let's verify render)
    const { container } = render(
      <PlayerStoreProvider store={store}>
        <QueuePanel />
      </PlayerStoreProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders QueueList content when mode is queue-open", () => {
    const store = makeStore();
    loadOne(store);
    store.getState().openQueue();
    render(
      <PlayerStoreProvider store={store}>
        <QueuePanel />
      </PlayerStoreProvider>,
    );
    expect(screen.getByText(/Queue · 1 track/i)).toBeInTheDocument();
    expect(screen.getByText("Test Track")).toBeInTheDocument();
  });

  it("close button calls closeOverlays and mode flips to mini", async () => {
    const store = makeStore();
    loadOne(store);
    store.getState().openQueue();
    render(
      <PlayerStoreProvider store={store}>
        <QueuePanel />
      </PlayerStoreProvider>,
    );
    expect(store.getState().mode).toBe("queue-open");
    await userEvent.click(screen.getByRole("button", { name: /close queue/i }));
    expect(store.getState().mode).toBe("mini");
  });
});
