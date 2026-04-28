import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCards } from "./stats-cards";

const fixedData = {
  playlists: 3,
  trackedVideos: 42,
  availablePct: 95,
  diskBytes: 1024,
};

describe("StatsCards", () => {
  it("renders all four labels", () => {
    render(<StatsCards data={fixedData} />);
    expect(screen.getByText("Playlists")).toBeInTheDocument();
    expect(screen.getByText("Tracked Videos")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Disk Usage")).toBeInTheDocument();
  });

  it("renders numeric values", () => {
    render(<StatsCards data={fixedData} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("renders FormattedBytes for disk usage (1024 bytes = 1.0 KB)", () => {
    render(<StatsCards data={fixedData} />);
    expect(screen.getByText("1.0 KB")).toBeInTheDocument();
  });

  it("renders 0 values without crashing", () => {
    render(
      <StatsCards
        data={{ playlists: 0, trackedVideos: 0, availablePct: 100, diskBytes: 0 }}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("0 B")).toBeInTheDocument();
  });
});
