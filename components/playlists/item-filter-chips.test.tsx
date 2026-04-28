import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

import { ItemFilterChips } from "./item-filter-chips";

describe("ItemFilterChips", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParamsValue = new URLSearchParams();
  });

  it('renders all 3 chips with default "all" active', () => {
    render(<ItemFilterChips />);
    expect(screen.getByText("all")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    // "all" chip should have the active (inverted) classes
    const allBtn = screen.getByText("all");
    expect(allBtn.className).toContain("bg-[var(--color-fg)]");
  });

  it("reflects ?filter=unavailable from URL", () => {
    searchParamsValue = new URLSearchParams("filter=unavailable");
    render(<ItemFilterChips />);
    const unavailableBtn = screen.getByText("unavailable");
    expect(unavailableBtn.className).toContain("bg-[var(--color-fg)]");
    const allBtn = screen.getByText("all");
    expect(allBtn.className).toContain("bg-[var(--color-muted-bg)]");
  });

  it('clicking "available" calls router.replace with ?filter=available', async () => {
    const user = userEvent.setup();
    render(<ItemFilterChips />);
    await user.click(screen.getByText("available"));
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("?filter=available");
  });

  it('clicking "all" deletes the filter param', async () => {
    searchParamsValue = new URLSearchParams("filter=available");
    const user = userEvent.setup();
    render(<ItemFilterChips />);
    await user.click(screen.getByText("all"));
    expect(replace).toHaveBeenCalledOnce();
    // deleting "filter" leaves empty params → "?"
    expect(replace).toHaveBeenCalledWith("?");
  });
});
