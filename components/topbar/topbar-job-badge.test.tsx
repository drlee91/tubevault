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
    } as any);
    const { container } = render(<TopbarJobBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows count when active", () => {
    vi.spyOn(hookMod, "useJobSummary").mockReturnValue({
      data: { queued: 1, running: 2, failed: 0, completed24h: 0 },
      error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(),
    } as any);
    render(<TopbarJobBadge />);
    expect(screen.getByText("3 active")).toBeInTheDocument();
  });

  it("highlights when failed > 0", () => {
    vi.spyOn(hookMod, "useJobSummary").mockReturnValue({
      data: { queued: 0, running: 0, failed: 2, completed24h: 0 },
      error: undefined, isLoading: false, isValidating: false, mutate: vi.fn(),
    } as any);
    render(<TopbarJobBadge />);
    expect(screen.getByText(/2 failed/)).toBeInTheDocument();
  });
});
