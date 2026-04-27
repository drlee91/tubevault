import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryRow } from "./history-row";
import type { SyncRunRow } from "./history-row";

function makeRun(overrides: Partial<SyncRunRow> = {}): SyncRunRow {
  return {
    id: 1,
    playlistId: 42,
    playlistTitle: "My Playlist",
    status: "success",
    videosAdded: 3,
    videosRemoved: 1,
    videosUnavailable: 2,
    videosDownloaded: 5,
    startedAt: new Date(Date.now() - 120_000).toISOString(),
    finishedAt: new Date(Date.now() - 60_000).toISOString(),
    triggeredBy: "manual",
    errorLog: null,
    ...overrides,
  };
}

describe("HistoryRow", () => {
  it("renders playlist title, counts, triggeredBy and status pill", () => {
    render(<HistoryRow run={makeRun()} />);

    expect(screen.getByText("My Playlist")).toBeInTheDocument();
    // Link points to the playlist
    expect(screen.getByRole("link")).toHaveAttribute("href", "/playlists/42");
    // counts shown
    expect(screen.getByText(/\+3/)).toBeInTheDocument();
    // status pill: success → "completed"
    expect(screen.getByText("completed")).toBeInTheDocument();
    // triggeredBy
    expect(screen.getByText(/manual/)).toBeInTheDocument();
  });

  it("maps partial status to 'partial' JobStatusPill variant", () => {
    render(<HistoryRow run={makeRun({ status: "partial" })} />);
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("clicking the toggle div flips aria-expanded", () => {
    render(<HistoryRow run={makeRun()} />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("shows error pre block when expanded and errorLog is non-empty array", () => {
    const errorLog = [{ code: "E001", message: "Something went wrong" }];
    render(<HistoryRow run={makeRun({ errorLog })} />);

    // pre not visible initially
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));

    const pre = screen.getByRole("button").parentElement!.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain("Something went wrong");
  });

  it("clicking the playlist Link does NOT toggle the disclosure (stopPropagation)", () => {
    render(<HistoryRow run={makeRun()} />);
    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const link = screen.getByRole("link");
    fireEvent.click(link);

    // aria-expanded should still be false — stopPropagation prevented the toggle
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
