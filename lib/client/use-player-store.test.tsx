import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PlayerStoreProvider, usePlayerStore } from "./use-player-store";
import { createPlayerStore } from "@/lib/player/store";

function Probe() {
  const idx = usePlayerStore((s) => s.currentIndex);
  return <span data-testid="idx">{idx}</span>;
}

describe("usePlayerStore", () => {
  it("reads state and reacts to updates", () => {
    const store = createPlayerStore();
    render(
      <PlayerStoreProvider store={store}>
        <Probe />
      </PlayerStoreProvider>,
    );
    expect(screen.getByTestId("idx").textContent).toBe("-1");
    act(() => {
      store.getState().setQueue([{
        videoId: 1, defaultKind: "audio", title: "T", channelTitle: null,
        thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"],
      }], 0);
    });
    expect(screen.getByTestId("idx").textContent).toBe("0");
  });

  it("throws helpful error when used outside provider", () => {
    const Bad = () => { usePlayerStore((s) => s.currentIndex); return null; };
    expect(() => render(<Bad />)).toThrow(/PlayerStoreProvider/);
  });
});
