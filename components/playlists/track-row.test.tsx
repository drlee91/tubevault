import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import { TrackRow } from "./track-row";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function makeItem(overrides: Partial<PlaylistDetailItem> = {}): PlaylistDetailItem {
  return {
    position: 0,
    inPlaylist: true,
    addedAt: "2024-01-01T00:00:00.000Z",
    removedFromPlaylistAt: null,
    video: {
      id: 1,
      externalId: "abc123",
      title: "Test Video Title",
      channelTitle: "Test Channel",
      durationSeconds: 240,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    },
    audioFile: null,
    videoFile: null,
    pendingJob: null,
    ...overrides,
  };
}

describe("TrackRow", () => {
  it("renders title and channel", () => {
    render(<TrackRow item={makeItem()} position={0} />);

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("shows JobStatusPill when pendingJob present", () => {
    const item = makeItem({
      pendingJob: {
        id: 10,
        type: "download",
        status: "running",
        attempts: 1,
        lastError: null,
      },
    });

    render(<TrackRow item={item} position={0} />);

    // JobStatusPill renders the status label
    expect(screen.getByText("running")).toBeInTheDocument();
    // StatusPill (availability) should NOT be visible — "available" label not rendered
    expect(screen.queryByText("available")).not.toBeInTheDocument();
  });

  it("shows StatusPill when no pendingJob", () => {
    const item = makeItem({
      pendingJob: null,
      video: {
        id: 1,
        externalId: "abc123",
        title: "Test Video Title",
        channelTitle: "Test Channel",
        durationSeconds: 240,
        thumbnailUrl: null,
        availabilityStatus: "removed",
        availabilityReason: null,
      },
    });

    render(<TrackRow item={item} position={0} />);

    // StatusPill renders the label for the availability status
    expect(screen.getByText("removed")).toBeInTheDocument();
    // JobStatusPill should NOT be present (no running/queued/etc text)
    expect(screen.queryByText("running")).not.toBeInTheDocument();
  });
});
