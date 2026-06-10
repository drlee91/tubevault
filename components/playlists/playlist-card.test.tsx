import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaylistCard } from "./playlist-card";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

function makeP(overrides: Partial<PlaylistStatsRow> = {}): PlaylistStatsRow {
  return {
    id: 1,
    provider: "youtube",
    externalId: "PLabcdef",
    title: "My PL",
    channelTitle: "Chan",
    url: "https://youtube.com/playlist?list=PLabcdef",
    defaultFormat: "audio",
    syncEnabled: true,
    lastSyncedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    stats: {
      totalItems: 5,
      availableItems: 4,
      unavailableItems: 1,
      downloadedItems: 2,
    },
    activeSyncRunId: null,
    coverThumbs: [],
    ...overrides,
  };
}

describe("PlaylistCard", () => {
  it("renders title, channel and item count", () => {
    render(<PlaylistCard p={makeP()} />);
    expect(screen.getByText("My PL")).toBeInTheDocument();
    expect(screen.getByText(/Chan · 5 Titel/)).toBeInTheDocument();
  });

  it("shows syncing icon when activeSyncRunId is set", () => {
    render(<PlaylistCard p={makeP({ activeSyncRunId: 42 })} />);
    expect(screen.getByLabelText("syncing")).toBeInTheDocument();
  });

  it("does not show syncing icon when activeSyncRunId is null", () => {
    render(<PlaylistCard p={makeP({ activeSyncRunId: null })} />);
    expect(screen.queryByLabelText("syncing")).not.toBeInTheDocument();
  });

  it("falls back to URL when title is null", () => {
    const p = makeP({ title: null });
    render(<PlaylistCard p={p} />);
    expect(screen.getByText(p.url)).toBeInTheDocument();
  });

  it("renders progress bar container", () => {
    const { container } = render(<PlaylistCard p={makeP()} />);
    // The inner progress div is present (width style applied)
    const progressFill = container.querySelector("[style*='width']");
    expect(progressFill).not.toBeNull();
  });
});
