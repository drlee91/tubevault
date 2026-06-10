import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import * as hookMod from "@/lib/client/use-job-summary";
import { TopbarJobBadge } from "./topbar-job-badge";

describe("TopbarJobBadge", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("hides when nothing active", () => {
    vi.spyOn(hookMod, "useJobSummary").mockReturnValue({
      data: { queued: 0, running: 0, failed: 0, completed24h: 0 },
      error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(),
    } as unknown as ReturnType<typeof hookMod.useJobSummary>);
    const { container } = render(<TopbarJobBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows spinner when active", () => {
    vi.spyOn(hookMod, "useJobSummary").mockReturnValue({
      data: { queued: 1, running: 2, failed: 0, completed24h: 0 },
      error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(),
    } as unknown as ReturnType<typeof hookMod.useJobSummary>);
    render(<TopbarJobBadge />);
    // Loader2 renders an svg; link is present with correct aria-label
    expect(screen.getByRole("link", { name: /active jobs/i })).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("shows failure count chip when failed > 0", () => {
    vi.spyOn(hookMod, "useJobSummary").mockReturnValue({
      data: { queued: 0, running: 0, failed: 2, completed24h: 0 },
      error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(),
    } as unknown as ReturnType<typeof hookMod.useJobSummary>);
    render(<TopbarJobBadge />);
    // chip shows the count digit
    expect(screen.getByText(/2/)).toBeInTheDocument();
    // sr-only text present
    expect(screen.getByText(/failed jobs/i)).toBeInTheDocument();
  });
});
