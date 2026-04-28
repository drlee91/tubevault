import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as useJobsModule from "@/lib/client/use-jobs";
import type { JobsList } from "@/lib/services/job-service";

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

// Stub sonner so RetryJobButton doesn't blow up
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stub retryJobAction
vi.mock("@/lib/actions/job-actions", () => ({
  retryJobAction: vi.fn().mockResolvedValue({ ok: true, data: { retried: true } }),
}));

import { JobsTab } from "./jobs-tab";

const baseJobsList: JobsList = {
  total: 0,
  jobs: [],
};

const jobFixture = {
  id: 1,
  type: "sync_playlist" as const,
  status: "queued" as const,
  attempts: 0,
  maxAttempts: 3,
  priority: 0,
  payload: {},
  lastError: null,
  createdAt: "2024-01-01T00:00:00Z",
  startedAt: null,
  finishedAt: null,
  nextAttemptAt: null,
  subject: { kind: "playlist" as const, id: 10, title: "Alpha Playlist" },
};

describe("JobsTab", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParamsValue = new URLSearchParams();
  });

  it("shows SkeletonRow when loading and no data yet", () => {
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: undefined,
      error: undefined,
      mutate: vi.fn(),
      isLoading: true,
      isValidating: true,
    } as ReturnType<typeof useJobsModule.useJobs>);

    render(<JobsTab />);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("shows ErrorCard when error", () => {
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: undefined,
      error: new Error("network failure"),
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    render(<JobsTab />);
    expect(screen.getByText("Couldn't load jobs")).toBeInTheDocument();
  });

  it("shows empty state when data.jobs is empty", () => {
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: { ...baseJobsList, jobs: [] },
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    render(<JobsTab />);
    expect(screen.getByText("No jobs match.")).toBeInTheDocument();
  });

  it("renders JobRows when data has jobs", () => {
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: { total: 1, jobs: [jobFixture] },
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    render(<JobsTab />);
    expect(screen.getByText("Alpha Playlist")).toBeInTheDocument();
    expect(screen.getByText("sync")).toBeInTheDocument();
  });

  it("clicking a filter chip calls router.replace with the correct URL", async () => {
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: baseJobsList,
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    const user = userEvent.setup();
    render(<JobsTab />);

    await user.click(screen.getByRole("button", { name: "failed" }));
    expect(replace).toHaveBeenCalledWith("/activity?tab=jobs&status=failed");
  });

  it("clicking 'all' filter deletes status param from URL", async () => {
    searchParamsValue = new URLSearchParams("status=failed");
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: baseJobsList,
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    const user = userEvent.setup();
    render(<JobsTab />);

    await user.click(screen.getByRole("button", { name: "all" }));
    expect(replace).toHaveBeenCalledWith("/activity?tab=jobs");
  });

  it("does not duplicate tab param when tab=jobs is already in URL", async () => {
    searchParamsValue = new URLSearchParams("tab=jobs");
    vi.spyOn(useJobsModule, "useJobs").mockReturnValue({
      data: baseJobsList,
      error: undefined,
      mutate: vi.fn(),
      isLoading: false,
      isValidating: false,
    } as ReturnType<typeof useJobsModule.useJobs>);

    const user = userEvent.setup();
    render(<JobsTab />);

    await user.click(screen.getByRole("button", { name: "failed" }));
    expect(replace).toHaveBeenCalledWith("/activity?tab=jobs&status=failed");
  });
});
