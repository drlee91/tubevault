import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityTabs } from "./activity-tabs";

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

describe("ActivityTabs", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParamsValue = new URLSearchParams();
  });

  it("defaults to history tab when no tab param", () => {
    render(
      <ActivityTabs
        history={<div data-testid="history">History content</div>}
        jobs={<div data-testid="jobs">Jobs content</div>}
      />
    );

    const historyTab = screen.getByRole("tab", { name: /history/i });
    expect(historyTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("history")).toBeInTheDocument();
    expect(screen.queryByTestId("jobs")).not.toBeInTheDocument();
  });

  it("shows jobs tab when ?tab=jobs", () => {
    searchParamsValue = new URLSearchParams("tab=jobs");
    render(
      <ActivityTabs
        history={<div data-testid="history">History content</div>}
        jobs={<div data-testid="jobs">Jobs content</div>}
      />
    );

    const jobsTab = screen.getByRole("tab", { name: /jobs/i });
    expect(jobsTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("jobs")).toBeInTheDocument();
    expect(screen.queryByTestId("history")).not.toBeInTheDocument();
  });

  it("calls router.replace with tab=jobs when Jobs tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ActivityTabs
        history={<div data-testid="history">History content</div>}
        jobs={<div data-testid="jobs">Jobs content</div>}
      />
    );

    await user.click(screen.getByRole("tab", { name: /jobs/i }));

    expect(replace).toHaveBeenCalledWith("/activity?tab=jobs");
  });
});
