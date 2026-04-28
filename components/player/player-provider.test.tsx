import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerProvider } from "./player-provider";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("<PlayerProvider>", () => {
  it("renders children + mounts a hidden audio element", () => {
    const { container } = render(
      <PlayerProvider><span data-testid="child">x</span></PlayerProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(container.querySelectorAll("audio").length).toBe(1);
  });
});
