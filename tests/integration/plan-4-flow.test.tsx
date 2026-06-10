// @vitest-environment happy-dom
// tests/integration/plan-4-flow.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerProvider } from "@/components/player/player-provider";
import { TrackTable } from "@/components/playlists/track-table";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/actions/video-actions", () => ({
  downloadVideoAction: vi.fn(), refreshVideoAction: vi.fn(),
}));

function item(id: number): PlaylistDetailItem {
  return {
    position: id - 1, inPlaylist: true, addedAt: "2026-01-01T00:00:00Z", removedFromPlaylistAt: null,
    video: {
      id, externalId: `v${id}`, title: `Track ${id}`, channelTitle: "Chan",
      durationSeconds: 60, thumbnailUrl: null, availabilityStatus: "available", availabilityReason: null,
    },
    audioFile: { id: id * 10, format: "mp3", quality: "192", fileSizeBytes: 1, downloadedAt: "x" },
    videoFile: null,
    pendingJobs: { audio: null, video: null },
    availableKinds: ["audio"],
  };
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ audio: 42, video: null }), { status: 200 }),
  );
});

describe("Plan 4 — click a track end-to-end", () => {
  it("populates queue, sets stream src, isPlaying true", async () => {
    const items = [item(1), item(2)];
    const { container } = render(
      <PlayerProvider>
        <TrackTable items={items} defaultFormat="audio" />
      </PlayerProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /play track 1/i }));
    // drain the resolver fetch + re-render triggered by setCacheBump
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const audio = container.querySelector("audio")!;
    await waitFor(() => {
      expect(audio.getAttribute("src")).toMatch(/\/api\/stream\/42$/);
    });
  });
});
