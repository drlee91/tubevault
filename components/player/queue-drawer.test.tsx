import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueueDrawer } from "./queue-drawer";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

describe("<QueueDrawer>", () => {
  it("opens when mode === 'queue-open'", () => {
    const store = createPlayerStore();
    render(<PlayerStoreProvider store={store}><QueueDrawer /></PlayerStoreProvider>);
    expect(screen.queryByText(/Queue ·/i)).not.toBeInTheDocument();
    act(() => { store.getState().openQueue(); });
    expect(screen.getByText(/Queue · 0 tracks/i)).toBeInTheDocument();
  });

  it("closes via store.closeOverlays", () => {
    const store = createPlayerStore();
    render(<PlayerStoreProvider store={store}><QueueDrawer /></PlayerStoreProvider>);
    act(() => { store.getState().openQueue(); });
    act(() => { store.getState().closeOverlays(); });
    expect(screen.queryByText(/Queue ·/i)).not.toBeInTheDocument();
  });
});
