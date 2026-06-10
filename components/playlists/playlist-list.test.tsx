import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaylistList } from "./playlist-list";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

function makeP(id: number, title: string): PlaylistStatsRow {
  return {
    id,
    provider: "youtube",
    externalId: `PL${id}`,
    title,
    channelTitle: "Chan",
    url: `https://youtube.com/playlist?list=PL${id}`,
    defaultFormat: "audio",
    syncEnabled: true,
    lastSyncedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    stats: {
      totalItems: 3,
      availableItems: 3,
      unavailableItems: 0,
      downloadedItems: 1,
    },
    activeSyncRunId: null,
    coverThumbs: [],
  };
}

describe("PlaylistList", () => {
  it("renders EmptyState when items is empty", () => {
    render(<PlaylistList items={[]} />);
    expect(screen.getByText("No playlists yet")).toBeInTheDocument();
    expect(screen.getByText("Add your first playlist to get started.")).toBeInTheDocument();
  });

  it("renders one card for a single item", () => {
    render(<PlaylistList items={[makeP(1, "Playlist Alpha")]} />);
    expect(screen.getByText("Playlist Alpha")).toBeInTheDocument();
    expect(screen.queryByText("No playlists yet")).not.toBeInTheDocument();
  });

  it("renders all cards for multiple items", () => {
    const items = [makeP(1, "Playlist Alpha"), makeP(2, "Playlist Beta")];
    render(<PlaylistList items={items} />);
    expect(screen.getByText("Playlist Alpha")).toBeInTheDocument();
    expect(screen.getByText("Playlist Beta")).toBeInTheDocument();
    // Two cards rendered — verify by heading role count
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(2);
  });
});
