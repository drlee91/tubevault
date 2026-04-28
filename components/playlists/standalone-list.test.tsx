import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as hookMod from "@/lib/client/use-standalone-videos";
import { StandaloneList } from "./standalone-list";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createPlayerStore } from "@/lib/player/store";

const baseHook = {
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: vi.fn(),
} as const;

const videoFixture = {
  id: 1,
  provider: "youtube" as const,
  externalId: "abc123",
  title: "My Test Video",
  channelTitle: "Test Channel",
  channelId: null,
  durationSeconds: 185,
  thumbnailUrl: null,
  availabilityStatus: "available" as const,
  availabilityReason: null,
  availabilityChangedAt: "2024-01-01T00:00:00.000Z",
  firstSeenAt: "2024-01-01T00:00:00.000Z",
  lastSeenAt: "2024-01-01T00:00:00.000Z",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

describe("StandaloneList", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders SkeletonRow while loading", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof hookMod.useStandaloneVideos>);
    render(<StandaloneList />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("No standalone videos")).not.toBeInTheDocument();
  });

  it("renders error card on fetch error", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: undefined,
      error: new Error("net"),
    } as unknown as ReturnType<typeof hookMod.useStandaloneVideos>);
    render(<StandaloneList />);
    expect(screen.getByText("Couldn't load standalone videos")).toBeInTheDocument();
  });

  it("renders empty state when no videos", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: { videos: [] },
    } as unknown as ReturnType<typeof hookMod.useStandaloneVideos>);
    render(<StandaloneList />);
    expect(screen.getByText("No standalone videos")).toBeInTheDocument();
    expect(screen.getByText("Add one via the + Add menu.")).toBeInTheDocument();
  });

  it("renders video rows when data is present", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: { videos: [videoFixture] },
    } as unknown as ReturnType<typeof hookMod.useStandaloneVideos>);
    render(<StandaloneList />);
    expect(screen.getByText("My Test Video")).toBeInTheDocument();
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });
});

it("clicking a row plays the standalone video", async () => {
  vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
    ...baseHook,
    data: { videos: [{ ...videoFixture, availableKinds: ["audio" as const] }] },
  } as unknown as ReturnType<typeof hookMod.useStandaloneVideos>);
  const store = createPlayerStore();
  render(
    <PlayerStoreProvider store={store}>
      <StandaloneList />
    </PlayerStoreProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: /play /i }));
  expect(store.getState().queue.length).toBe(1);
  expect(store.getState().isPlaying).toBe(true);
});
