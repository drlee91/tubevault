import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueueList } from "./queue-list";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

function withItems(n: number) {
  const store = createPlayerStore();
  store.getState().setQueue(
    Array.from({ length: n }, (_, i) => ({
      videoId: i + 1, defaultKind: "audio" as const, title: `T${i + 1}`,
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] as const,
    })),
    0,
  );
  return store;
}

describe("<QueueList>", () => {
  it("shows all queue items with title + Now-Playing marker on the current track", () => {
    const store = withItems(3);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBe(3);
    expect(within(rows[0]!).getByLabelText("Now playing")).toBeInTheDocument();
  });

  it("Remove button removes the item", async () => {
    const store = withItems(3);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    await userEvent.click(screen.getAllByRole("button", { name: /remove from queue/i })[2]!);
    expect(store.getState().queue.length).toBe(2);
  });

  it("Clear queue button empties", async () => {
    const store = withItems(2);
    render(<PlayerStoreProvider store={store}><QueueList /></PlayerStoreProvider>);
    await userEvent.click(screen.getByRole("button", { name: /clear queue/i }));
    expect(store.getState().queue.length).toBe(0);
  });
});
