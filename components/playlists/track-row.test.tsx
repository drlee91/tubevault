import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    pendingJobs: { audio: null, video: null },
    availableKinds: [],
    ...overrides,
  };
}

describe("TrackRow", () => {
  it("renders title and channel", () => {
    render(<TrackRow item={makeItem()} position={0} />);

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("does not render StatusPill or JobStatusPill text", () => {
    render(<TrackRow item={makeItem()} position={0} />);

    // No pill labels in the row anymore
    expect(screen.queryByText("available")).not.toBeInTheDocument();
    expect(screen.queryByText("running")).not.toBeInTheDocument();
    expect(screen.queryByText("removed")).not.toBeInTheDocument();
  });

  it("applies opacity-60 when status is not available or unknown", () => {
    const item = makeItem({
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

    const { container } = render(<TrackRow item={item} position={0} />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain("opacity-60");
  });

  it("does not apply opacity-60 when status is available", () => {
    const { container } = render(<TrackRow item={makeItem()} position={0} />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain("opacity-60");
  });

  it("does not apply opacity-60 when status is unknown", () => {
    const item = makeItem({
      video: {
        id: 1,
        externalId: "abc123",
        title: "Test Video Title",
        channelTitle: "Test Channel",
        durationSeconds: 240,
        thumbnailUrl: null,
        availabilityStatus: "unknown",
        availabilityReason: null,
      },
    });

    const { container } = render(<TrackRow item={item} position={0} />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain("opacity-60");
  });
});

describe("TrackRow click", () => {
  it("invokes onPlay when thumbnail button clicked", async () => {
    const onPlay = vi.fn();
    render(<TrackRow item={makeItem()} position={0} onPlay={onPlay} />);
    await userEvent.click(screen.getByRole("button", { name: /play test video title/i }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("renders NowPlayingIndicator when isCurrent", () => {
    render(<TrackRow item={makeItem()} position={0} onPlay={() => {}} isCurrent isPlaying />);
    expect(screen.getByLabelText("Now playing")).toBeInTheDocument();
  });
});
