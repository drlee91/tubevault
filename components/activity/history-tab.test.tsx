import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryList } from "./history-tab";
import type { SyncRunRow } from "./history-row";

function makeRun(overrides: Partial<SyncRunRow> = {}): SyncRunRow {
  return {
    id: 1,
    playlistId: 42,
    playlistTitle: "My Playlist",
    status: "success",
    videosAdded: 0,
    videosRemoved: 0,
    videosUnavailable: 0,
    videosDownloaded: 0,
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    finishedAt: new Date(Date.now() - 60_000).toISOString(),
    triggeredBy: "manual",
    errorLog: null,
    ...overrides,
  };
}

describe("HistoryList", () => {
  it("renders empty state when runs is empty", () => {
    render(<HistoryList runs={[]} />);
    expect(screen.getByText("No syncs yet")).toBeInTheDocument();
  });

  it("renders a HistoryRow for each run", () => {
    const runs = [
      makeRun({ id: 1, playlistTitle: "Playlist Alpha" }),
      makeRun({ id: 2, playlistTitle: "Playlist Beta" }),
    ];
    render(<HistoryList runs={runs} />);
    expect(screen.getByText("Playlist Alpha")).toBeInTheDocument();
    expect(screen.getByText("Playlist Beta")).toBeInTheDocument();
  });

  it("renders a single run with correct pill for failed status", () => {
    render(<HistoryList runs={[makeRun({ status: "failed" })]} />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });
});
