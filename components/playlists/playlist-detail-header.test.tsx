import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaylistDetailHeader } from "./playlist-detail-header";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makePlaylist(overrides: Partial<PlaylistStatsRow> = {}): PlaylistStatsRow {
  return {
    id: 1,
    provider: "youtube",
    externalId: "PLtest",
    title: "My Playlist",
    channelTitle: "My Channel",
    url: "https://youtube.com/playlist?list=PLtest",
    defaultFormat: "audio",
    syncEnabled: true,
    lastSyncedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    stats: {
      totalItems: 10,
      availableItems: 8,
      unavailableItems: 2,
      downloadedItems: 5,
    },
    activeSyncRunId: null,
    ...overrides,
  };
}

describe("PlaylistDetailHeader", () => {
  it("renders title, counts, and 'never' when lastSyncedAt is null", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist()} />);
    expect(screen.getByText("My Playlist")).toBeInTheDocument();
    expect(screen.getByText(/My Channel/)).toBeInTheDocument();
    expect(screen.getByText(/10 items/)).toBeInTheDocument();
    expect(screen.getByText(/5 downloaded/)).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("falls back to 'Untitled' when title is null", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist({ title: null })} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("SyncNowButton is disabled when activeSyncRunId is not null", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist({ activeSyncRunId: 42 })} />);
    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
  });
});
