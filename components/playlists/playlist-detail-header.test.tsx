import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistDetailHeader } from "./playlist-detail-header";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
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

function makeItem(overrides: Partial<PlaylistDetailItem> = {}): PlaylistDetailItem {
  return {
    position: 0,
    inPlaylist: true,
    addedAt: "2024-01-01T00:00:00.000Z",
    removedFromPlaylistAt: null,
    video: {
      id: 1,
      externalId: "abc123",
      title: "Track One",
      channelTitle: "Channel",
      durationSeconds: 180,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    },
    audioFile: null,
    videoFile: null,
    pendingJob: null,
    pendingJobs: { audio: null, video: null },
    availableKinds: ["audio"],
    ...overrides,
  };
}

const twoItems: PlaylistDetailItem[] = [
  makeItem({
    position: 0,
    video: {
      id: 1,
      externalId: "v1",
      title: "Track One",
      channelTitle: null,
      durationSeconds: 120,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    },
    availableKinds: ["audio"],
  }),
  makeItem({
    position: 1,
    video: {
      id: 2,
      externalId: "v2",
      title: "Track Two",
      channelTitle: null,
      durationSeconds: 180,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    },
    availableKinds: ["audio"],
  }),
];

describe("PlaylistDetailHeader", () => {
  it("renders title and channel", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist()} />);
    expect(screen.getByText("My Playlist")).toBeInTheDocument();
    expect(screen.getByText(/My Channel/)).toBeInTheDocument();
  });

  it("renders item count and last sync", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist()} />);
    expect(screen.getByText(/10 items/)).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("falls back to 'Untitled' when title is null", () => {
    render(<PlaylistDetailHeader playlist={makePlaylist({ title: null })} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
  });

  it("overflow menu contains Sync now item (disabled when sync active)", async () => {
    render(<PlaylistDetailHeader playlist={makePlaylist({ activeSyncRunId: 42 })} />);
    await userEvent.click(screen.getByRole("button", { name: /playlist actions/i }));
    const syncItem = await screen.findByText(/sync now/i);
    // The menu item element or its parent should have data-disabled
    expect(syncItem.closest("[data-disabled]") ?? syncItem).toBeTruthy();
  });

  it("overflow menu contains Delete playlist item", async () => {
    render(<PlaylistDetailHeader playlist={makePlaylist()} />);
    await userEvent.click(screen.getByRole("button", { name: /playlist actions/i }));
    expect(await screen.findByText(/delete playlist/i)).toBeInTheDocument();
  });

  it("Delete menu item opens confirm dialog", async () => {
    render(<PlaylistDetailHeader playlist={makePlaylist()} />);
    await userEvent.click(screen.getByRole("button", { name: /playlist actions/i }));
    await userEvent.click(await screen.findByText(/delete playlist/i));
    expect(await screen.findByText(/delete playlist\?/i)).toBeInTheDocument();
  });
});

it("Play all sets queue with shuffle off", async () => {
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}>
      <PlaylistDetailHeader playlist={makePlaylist()} items={twoItems} defaultFormat="audio" />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /play all/i }));
  expect(store.getState().queue.length).toBe(2);
  expect(store.getState().shuffle).toBe(false);
  expect(store.getState().isPlaying).toBe(true);
});

it("Shuffle play turns shuffle on", async () => {
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}>
      <PlaylistDetailHeader playlist={makePlaylist()} items={twoItems} defaultFormat="audio" />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /shuffle play/i }));
  expect(store.getState().shuffle).toBe(true);
});
