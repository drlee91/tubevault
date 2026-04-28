import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlaylistDetailItem } from "@/lib/services/playlist-service";
import { createPlayerStore } from "@/lib/player/store";

let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

// Mock TrackRow to keep tests focused on filtering logic,
// but forward onPlay so click tests work.
vi.mock("./track-row", () => ({
  TrackRow: ({
    item,
    onPlay,
  }: {
    item: PlaylistDetailItem;
    position: number;
    onPlay?: () => void;
    isCurrent?: boolean;
    isPlaying?: boolean;
  }) => (
    <div data-testid="track-row">
      <button onClick={onPlay} aria-label={`play ${item.video.title}`}>
        {item.video.title}
      </button>
    </div>
  ),
}));

// Module-level store reference; replaced per-test in the click integration test.
let _mockStore = createPlayerStore();

vi.mock("@/lib/client/use-player-store", () => ({
  usePlayerStore: (selector: (s: ReturnType<typeof _mockStore["getState"]>) => unknown) =>
    selector(_mockStore.getState()),
  usePlayerStoreApi: () => _mockStore,
  PlayerStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TrackTable } from "./track-table";

function makeItem(
  id: number,
  title: string,
  availabilityStatus: string,
  inPlaylist = true,
  availableKinds: ("audio" | "video")[] = [],
): PlaylistDetailItem {
  return {
    position: id,
    inPlaylist,
    addedAt: "2024-01-01T00:00:00.000Z",
    removedFromPlaylistAt: null,
    video: {
      id,
      externalId: `ext${id}`,
      title,
      channelTitle: "Test Channel",
      durationSeconds: 180,
      thumbnailUrl: null,
      availabilityStatus,
      availabilityReason: null,
    },
    audioFile: null,
    videoFile: null,
    pendingJob: null,
    availableKinds,
  };
}

const ITEMS: PlaylistDetailItem[] = [
  makeItem(1, "Alpha Video", "available"),
  makeItem(2, "Beta Video", "unavailable"),
  makeItem(3, "Gamma Video", "removed"),
  makeItem(4, "Delta Video", "available", false), // not in playlist
];

describe("TrackTable", () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams();
    _mockStore = createPlayerStore();
  });

  it("renders all in-playlist items by default (filter=all)", () => {
    render(<TrackTable items={ITEMS} defaultFormat="audio" />);
    const rows = screen.getAllByTestId("track-row");
    // 3 in-playlist items (Delta is excluded because inPlaylist=false)
    expect(rows).toHaveLength(3);
    expect(screen.getByText("Alpha Video")).toBeInTheDocument();
    expect(screen.getByText("Beta Video")).toBeInTheDocument();
    expect(screen.getByText("Gamma Video")).toBeInTheDocument();
    expect(screen.queryByText("Delta Video")).not.toBeInTheDocument();
  });

  it("filter=available hides unavailable/removed items", () => {
    searchParamsValue = new URLSearchParams("filter=available");
    render(<TrackTable items={ITEMS} defaultFormat="audio" />);
    const rows = screen.getAllByTestId("track-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("Alpha Video")).toBeInTheDocument();
    expect(screen.queryByText("Beta Video")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma Video")).not.toBeInTheDocument();
  });

  it("filter=unavailable hides available items", () => {
    searchParamsValue = new URLSearchParams("filter=unavailable");
    render(<TrackTable items={ITEMS} defaultFormat="audio" />);
    const rows = screen.getAllByTestId("track-row");
    // Beta (unavailable) + Gamma (removed) should show
    expect(rows).toHaveLength(2);
    expect(screen.queryByText("Alpha Video")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Video")).toBeInTheDocument();
    expect(screen.getByText("Gamma Video")).toBeInTheDocument();
  });

  it("search query filters by title", async () => {
    const user = userEvent.setup();
    render(<TrackTable items={ITEMS} defaultFormat="audio" />);
    const input = screen.getByPlaceholderText("Search items");
    await user.type(input, "alpha");
    expect(screen.getByText("Alpha Video")).toBeInTheDocument();
    expect(screen.queryByText("Beta Video")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma Video")).not.toBeInTheDocument();
  });

  it('shows "No items match." when nothing matches', async () => {
    const user = userEvent.setup();
    render(<TrackTable items={ITEMS} defaultFormat="audio" />);
    const input = screen.getByPlaceholderText("Search items");
    await user.type(input, "xyz");
    expect(screen.getByText("No items match.")).toBeInTheDocument();
    expect(screen.queryByTestId("track-row")).not.toBeInTheDocument();
  });

  it("clicking a row sets the player queue + plays", async () => {
    const store = createPlayerStore();
    _mockStore = store;

    const items: PlaylistDetailItem[] = [
      makeItem(1, "First Video", "available", true, ["audio"]),
      makeItem(2, "Second Video", "available", true, ["audio"]),
    ];

    render(<TrackTable items={items} defaultFormat="audio" />);

    await userEvent.click(screen.getAllByRole("button", { name: /play /i })[1]!);

    expect(store.getState().queue.length).toBe(2);
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().isPlaying).toBe(true);
  });
});
