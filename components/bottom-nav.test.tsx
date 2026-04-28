import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("renders four navigation links with correct hrefs", () => {
    render(<BottomNav />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links[1]).toHaveAttribute("href", "/playlists");
    expect(links[2]).toHaveAttribute("href", "/activity");
    expect(links[3]).toHaveAttribute("href", "/settings");
  });

  it("renders all four labels", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Playlists")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
