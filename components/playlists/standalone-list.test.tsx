import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as hookMod from "@/lib/client/use-standalone-videos";
import { StandaloneList } from "./standalone-list";

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
  availabilityChangedAt: new Date("2024-01-01T00:00:00Z"),
  firstSeenAt: new Date("2024-01-01T00:00:00Z"),
  lastSeenAt: new Date("2024-01-01T00:00:00Z"),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

describe("StandaloneList", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders SkeletonRow while loading", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: undefined,
      isLoading: true,
    } as any);
    render(<StandaloneList />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("No standalone videos")).not.toBeInTheDocument();
  });

  it("renders error card on fetch error", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: undefined,
      error: new Error("net"),
    } as any);
    render(<StandaloneList />);
    expect(screen.getByText("Couldn't load standalone videos")).toBeInTheDocument();
  });

  it("renders empty state when no videos", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: { videos: [] },
    } as any);
    render(<StandaloneList />);
    expect(screen.getByText("No standalone videos")).toBeInTheDocument();
    expect(screen.getByText("Add one via the + Add menu.")).toBeInTheDocument();
  });

  it("renders video rows when data is present", () => {
    vi.spyOn(hookMod, "useStandaloneVideos").mockReturnValue({
      ...baseHook,
      data: { videos: [videoFixture] },
    } as any);
    render(<StandaloneList />);
    expect(screen.getByText("My Test Video")).toBeInTheDocument();
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });
});
