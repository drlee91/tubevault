import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlaylistDetailDto } from "@/lib/services/playlist-service";
import * as hookMod from "@/lib/client/use-playlist-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock TrackRow so TrackTable renders items as simple divs
vi.mock("./track-row", () => ({
  TrackRow: ({ item }: { item: { video: { title: string } } }) => (
    <div data-testid="track-row">{item.video.title}</div>
  ),
}));

beforeEach(() => vi.restoreAllMocks());

const playlistFixture = {
  id: 1,
  provider: "youtube" as const,
  externalId: "PL1",
  title: "My PL",
  channelTitle: "Chan",
  url: "https://www.youtube.com/playlist?list=PL1",
  defaultFormat: "audio" as const,
  syncEnabled: true,
  lastSyncedAt: null,
  createdAt: "2024-01-01T00:00:00Z",
  stats: { totalItems: 1, availableItems: 1, unavailableItems: 0, downloadedItems: 0 },
  activeSyncRunId: null,
};

const itemFixture = {
  video: {
    id: 100,
    externalId: "vid100",
    title: "Test Track",
    channelTitle: "Chan",
    thumbnailUrl: null,
    durationSeconds: 180,
    availabilityStatus: "available",
    availabilityReason: null,
  },
  addedAt: "2024-01-01T00:00:00Z",
  removedFromPlaylistAt: null,
  inPlaylist: true,
  position: 0,
  audioFile: null,
  videoFile: null,
  pendingJob: null,
  availableKinds: [],
};

const initialData: PlaylistDetailDto = {
  playlist: playlistFixture,
  items: [itemFixture],
  recentSyncRuns: [],
};

import { PlaylistDetailItems } from "./playlist-detail-items";

describe("PlaylistDetailItems", () => {
  it("renders TrackTable with initialData even before fetch", () => {
    vi.spyOn(hookMod, "usePlaylistDetail").mockReturnValue({
      data: initialData,
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof hookMod.usePlaylistDetail>);

    render(<PlaylistDetailItems playlistId={1} initialData={initialData} />);

    expect(screen.getByText("Test Track")).toBeInTheDocument();
  });

  it("renders ErrorCard on error", () => {
    vi.spyOn(hookMod, "usePlaylistDetail").mockReturnValue({
      data: undefined,
      error: new Error("net"),
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof hookMod.usePlaylistDetail>);

    render(<PlaylistDetailItems playlistId={1} initialData={initialData} />);

    expect(screen.getByText("Couldn't refresh")).toBeInTheDocument();
  });

  it("returns null when no data and no error", () => {
    vi.spyOn(hookMod, "usePlaylistDetail").mockReturnValue({
      data: undefined,
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof hookMod.usePlaylistDetail>);

    const { container } = render(<PlaylistDetailItems playlistId={1} initialData={initialData} />);

    expect(container).toBeEmptyDOMElement();
  });
});
