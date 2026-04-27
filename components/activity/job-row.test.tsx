import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobRow } from "./job-row";
import type { JobsListItem } from "@/lib/services/job-service";

// Avoid real retryJobAction server-action calls in tests
vi.mock("@/lib/actions/job-actions", () => ({
  retryJobAction: vi.fn().mockResolvedValue({ ok: true, data: { retried: true } }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function makeJob(overrides: Partial<JobsListItem> = {}): JobsListItem {
  return {
    id: 1,
    type: "sync_playlist",
    status: "queued",
    attempts: 1,
    maxAttempts: 3,
    priority: 0,
    payload: {},
    lastError: null,
    createdAt: "2024-01-01T00:00:00Z",
    startedAt: "2024-01-01T00:01:00Z",
    finishedAt: null,
    nextAttemptAt: null,
    subject: { kind: "playlist", id: 10, title: "My Playlist" },
    ...overrides,
  };
}

describe("JobRow", () => {
  it("renders job type badge, status pill, title, attempts and maxAttempts", () => {
    render(<JobRow job={makeJob()} onMutate={vi.fn()} />);

    // job type badge label
    expect(screen.getByText("sync")).toBeInTheDocument();
    // status pill
    expect(screen.getByText("queued")).toBeInTheDocument();
    // title from subject
    expect(screen.getByText("My Playlist")).toBeInTheDocument();
    // attempts/maxAttempts
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("shows RetryJobButton when status is failed", () => {
    render(<JobRow job={makeJob({ status: "failed" })} onMutate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows Cancel trigger (disabled button) when status is running", () => {
    render(<JobRow job={makeJob({ status: "running" })} onMutate={vi.fn()} />);
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn).toBeDisabled();
  });

  it("shows '—' placeholder when subject is null", () => {
    render(<JobRow job={makeJob({ subject: null })} onMutate={vi.fn()} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders lastError preview text when present", () => {
    render(
      <JobRow
        job={makeJob({ lastError: "Connection refused: too many retries" })}
        onMutate={vi.fn()}
      />
    );
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });
});
