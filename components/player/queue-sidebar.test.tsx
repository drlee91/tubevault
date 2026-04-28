import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueueSidebar } from "./queue-sidebar";
import { createPlayerStore } from "@/lib/player/store";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";

describe("<QueueSidebar>", () => {
  it("renders QueueList inside a 320-px right column with the @container query class", () => {
    const store = createPlayerStore();
    const { container } = render(
      <PlayerStoreProvider store={store}><QueueSidebar /></PlayerStoreProvider>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/hidden/);
    expect(root.className).toMatch(/@\[1280px\]:block/);
    expect(screen.getByText(/Queue · 0 tracks/i)).toBeInTheDocument();
  });
});
