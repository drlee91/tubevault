import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentActivity } from "./recent-activity";

const makeItem = (overrides: Partial<Parameters<typeof RecentActivity>[0]["items"][0]> = {}) => ({
  id: 1,
  playlistId: 42,
  playlistTitle: "My Test Playlist",
  status: "success" as const,
  videosAdded: 3,
  videosRemoved: 1,
  videosUnavailable: 0,
  finishedAt: new Date(Date.now() - 60_000).toISOString(),
  triggeredBy: "manual",
  ...overrides,
});

describe("RecentActivity", () => {
  it("renders empty state when items is empty", () => {
    render(<RecentActivity items={[]} />);
    expect(screen.getByText("No syncs yet")).toBeInTheDocument();
    expect(screen.getByText("Add a playlist to start.")).toBeInTheDocument();
  });

  it("renders one item with playlist title and link href", () => {
    render(<RecentActivity items={[makeItem()]} />);
    expect(screen.getByText("My Test Playlist")).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/playlists/42");
  });

  it("renders JobStatusPill for success status (shows completed)", () => {
    render(<RecentActivity items={[makeItem({ status: "success" })]} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("renders JobStatusPill for failed status", () => {
    render(<RecentActivity items={[makeItem({ status: "failed" })]} />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("renders JobStatusPill for running status", () => {
    render(<RecentActivity items={[makeItem({ status: "running" })]} />);
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("renders JobStatusPill for partial status (shows partial)", () => {
    render(<RecentActivity items={[makeItem({ status: "partial" })]} />);
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("renders orphan item (playlistId null) as non-link", () => {
    render(<RecentActivity items={[makeItem({ playlistId: null, playlistTitle: "(deleted playlist)" })]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("(deleted playlist)")).toBeInTheDocument();
  });

  it("renders video counts", () => {
    render(<RecentActivity items={[makeItem({ videosAdded: 5, videosRemoved: 2, videosUnavailable: 1 })]} />);
    expect(screen.getByText(/\+5/)).toBeInTheDocument();
  });

  it("renders null finishedAt as 'never'", () => {
    render(<RecentActivity items={[makeItem({ finishedAt: null })]} />);
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("renders multiple items", () => {
    const items = [
      makeItem({ id: 1, playlistId: 10, playlistTitle: "Playlist A" }),
      makeItem({ id: 2, playlistId: 20, playlistTitle: "Playlist B" }),
    ];
    render(<RecentActivity items={items} />);
    expect(screen.getByText("Playlist A")).toBeInTheDocument();
    expect(screen.getByText("Playlist B")).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/playlists/10");
    expect(links[1]).toHaveAttribute("href", "/playlists/20");
  });
});
