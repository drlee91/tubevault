import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as jobActions from "@/lib/actions/job-actions";
import { RetryJobButton } from "./retry-job-button";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("RetryJobButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls retryJobAction on click, toasts success and invokes onRetried", async () => {
    const spy = vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: true,
      data: { retried: true },
    });
    const onRetried = vi.fn();

    render(<RetryJobButton jobId={7} onRetried={onRetried} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(7);
    expect(toast.success).toHaveBeenCalledWith("Retry queued");
    expect(onRetried).toHaveBeenCalledOnce();
  });

  it("shows error toast on failure", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "not retryable" },
    });

    render(<RetryJobButton jobId={7} />);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await Promise.resolve();

    expect(toast.error).toHaveBeenCalledWith("Retry failed", { description: "not retryable" });
  });

  it("button renders with Retry label", () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({ ok: true, data: { retried: true } });
    render(<RetryJobButton jobId={1} />);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
