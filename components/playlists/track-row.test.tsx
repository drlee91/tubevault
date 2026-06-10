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

  it("saved tracks (removed on YouTube but downloaded) are not dimmed and show the archived badge", () => {
    const item = makeItem({
      video: {
        id: 1, externalId: "abc123", title: "Test Video Title", channelTitle: "Test Channel",
        durationSeconds: 240, thumbnailUrl: null, availabilityStatus: "removed", availabilityReason: null,
      },
      audioFile: { id: 5, format: "mp3", quality: "192", fileSizeBytes: 1000, downloadedAt: "2024-01-01T00:00:00.000Z" },
      videoFile: { id: 6, format: "mp4", quality: "1080p", fileSizeBytes: 9000, downloadedAt: "2024-01-01T00:00:00.000Z" },
      availableKinds: ["audio", "video"],
    });

    const { container } = render(<TrackRow item={item} position={0} />);

    const row = container.firstChild as HTMLElement;
    expect(row.className).not.toContain("opacity-60");
    expect(screen.getByLabelText(/auf youtube entfernt/i)).toBeInTheDocument();
  });

  it("removed tracks without local files show no retry button (no pointless retries)", () => {
    const item = makeItem({
      video: {
        id: 1, externalId: "abc123", title: "Test Video Title", channelTitle: "Test Channel",
        durationSeconds: 240, thumbnailUrl: null, availabilityStatus: "removed", availabilityReason: null,
      },
      pendingJobs: {
        audio: { id: 9, status: "failed", attempts: 1, lastError: "Video unavailable" },
        video: { id: 10, status: "failed", attempts: 1, lastError: "Video unavailable" },
      },
    });

    render(<TrackRow item={item} position={0} />);

    expect(screen.queryByRole("button", { name: /retry audio download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry video download/i })).not.toBeInTheDocument();
    // the slots fall back to the disabled missing state instead
    expect(screen.getByRole("button", { name: /download audio/i })).toBeDisabled();
  });

  it("available tracks with a failed job still offer the retry button", () => {
    const item = makeItem({
      pendingJobs: {
        audio: { id: 9, status: "failed", attempts: 1, lastError: "network" },
        video: null,
      },
    });

    render(<TrackRow item={item} position={0} />);

    expect(screen.getByRole("button", { name: /retry audio download/i })).toBeInTheDocument();
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
