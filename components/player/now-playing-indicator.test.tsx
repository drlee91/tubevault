import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NowPlayingIndicator } from "./now-playing-indicator";

describe("<NowPlayingIndicator>", () => {
  it("renders an animated dot when isPlaying", () => {
    render(<NowPlayingIndicator isPlaying />);
    const dot = screen.getByLabelText("Now playing");
    expect(dot).toBeInTheDocument();
    expect(dot.className).toMatch(/animate-pulse/);
  });

  it("dot static when paused", () => {
    render(<NowPlayingIndicator isPlaying={false} />);
    const dot = screen.getByLabelText("Now playing");
    expect(dot.className).not.toMatch(/animate-pulse/);
  });
});
