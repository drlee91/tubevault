import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as videoActions from "@/lib/actions/video-actions";
import { TrackContextMenu } from "./track-context-menu";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("TrackContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens menu and shows all 5 items", async () => {
    render(
      <TrackContextMenu
        videoId={1}
        externalUrl="https://www.youtube.com/watch?v=abc"
        available={true}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));

    expect(await screen.findByRole("menuitem", { name: /open on youtube/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /re-download as audio/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /re-download as video/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /refresh availability/i })).toBeInTheDocument();
  });

  it("disables Re-download items when not available", async () => {
    render(
      <TrackContextMenu
        videoId={2}
        externalUrl="https://www.youtube.com/watch?v=xyz"
        available={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));

    const audioItem = await screen.findByRole("menuitem", { name: /re-download as audio/i });
    const videoItem = screen.getByRole("menuitem", { name: /re-download as video/i });

    // base-ui sets data-disabled on disabled items
    expect(audioItem).toHaveAttribute("data-disabled");
    expect(videoItem).toHaveAttribute("data-disabled");
  });

  it("calls refreshVideoAction when 'Refresh availability' clicked", async () => {
    const spy = vi.spyOn(videoActions, "refreshVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 99 },
    });

    render(
      <TrackContextMenu
        videoId={3}
        externalUrl="https://www.youtube.com/watch?v=def"
        available={true}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /refresh availability/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(3);
    });
  });
});

const queueItem = {
  videoId: 1, defaultKind: "audio" as const, title: "T",
  channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio" as const],
};

it("Play Now replaces the queue", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([{ ...queueItem, videoId: 99 }], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /play now/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([1]);
});

it("Add to Queue appends", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([{ ...queueItem, videoId: 99 }], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /add to queue/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([99, 1]);
});

it("Play Next inserts after current", async () => {
  const store = createPlayerStore();
  store.getState().setQueue([
    { ...queueItem, videoId: 99 },
    { ...queueItem, videoId: 100 },
  ], 0);
  render(
    <PlayerStoreProvider store={store}>
      <TrackContextMenu videoId={1} externalUrl="https://x" available queueItem={queueItem} />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /play next/i }));
  expect(store.getState().queue.map((q) => q.videoId)).toEqual([99, 1, 100]);
});
