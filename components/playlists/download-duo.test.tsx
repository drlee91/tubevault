import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as videoActions from "@/lib/actions/video-actions";
import * as jobActions from "@/lib/actions/job-actions";
import { DownloadDuo } from "./download-duo";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

const baseProps = {
  videoId: 42,
  canDownload: true,
  onMutate: vi.fn(),
};

describe("DownloadDuo – audio slot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("present: renders solid icon with ok-color class and correct aria-label", () => {
    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "present", format: "mp3", sizeBytes: 1024 * 1024 * 5 }}
        video={{ state: "missing" }}
      />,
    );
    const el = screen.getByLabelText("audio downloaded (mp3)");
    expect(el).toBeInTheDocument();
    // The span itself carries the ok-color inline style via className
    expect(el.className).toMatch(/color-ok/);
  });

  it("present: tooltip contains format and size", () => {
    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "present", format: "mp3", sizeBytes: 1024 * 1024 * 5 }}
        video={{ state: "missing" }}
      />,
    );
    const el = screen.getByLabelText("audio downloaded (mp3)");
    expect(el).toHaveAttribute("title");
    const title = el.getAttribute("title")!;
    expect(title).toContain("mp3");
    expect(title).toContain("5.0");
  });

  it("missing + canDownload: renders an enabled button that calls downloadVideoAction", async () => {
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 1 },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    const btn = screen.getByRole("button", { name: /download audio/i });
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);

    await waitFor(() => {
      expect(videoActions.downloadVideoAction).toHaveBeenCalledWith(42, "audio");
    });
  });

  it("missing + canDownload: calls onMutate after successful download", async () => {
    const onMutate = vi.fn();
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 1 },
    });

    render(
      <DownloadDuo
        {...baseProps}
        onMutate={onMutate}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /download audio/i }));

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalledOnce();
    });
  });

  it("missing + !canDownload: renders a disabled button", () => {
    render(
      <DownloadDuo
        {...baseProps}
        canDownload={false}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    const btn = screen.getByRole("button", { name: /download audio/i });
    expect(btn).toBeDisabled();
  });

  it("missing: shows error toast on download failure", async () => {
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "quota exceeded" },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /download audio/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Download failed", {
        description: "quota exceeded",
      });
    });
  });

  it("missing: spinner persists after ok action while slot prop is still 'missing' (optimistic gap)", async () => {
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 1 },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /download audio/i }));

    // action resolved ok but parent hasn't fed new slot data yet — spinner must stay
    await waitFor(() => {
      expect(screen.getByLabelText("audio download queued")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /download audio/i })).not.toBeInTheDocument();
    });
  });

  it("missing: button returns when action fails (no optimistic gap on failure)", async () => {
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "quota exceeded" },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /download audio/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download audio/i })).toBeInTheDocument();
    });
  });

  it("pending: renders spinner with correct aria-label and no button", () => {
    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "pending", status: "running" }}
        video={{ state: "missing" }}
      />,
    );

    expect(screen.getByLabelText("audio download running")).toBeInTheDocument();
    // No download button for the audio slot
    expect(screen.queryByRole("button", { name: /download audio/i })).not.toBeInTheDocument();
  });

  it("pending queued: aria-label includes queued", () => {
    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "pending", status: "queued" }}
        video={{ state: "missing" }}
      />,
    );

    expect(screen.getByLabelText("audio download queued")).toBeInTheDocument();
  });

  it("failed: renders a button that triggers retryJobAction", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: true,
      data: { retried: true },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "failed", jobId: 7 }}
        video={{ state: "missing" }}
      />,
    );

    const btn = screen.getByRole("button", { name: /retry audio/i });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    await waitFor(() => {
      expect(jobActions.retryJobAction).toHaveBeenCalledWith(7);
    });
  });

  it("failed: calls onMutate after successful retry", async () => {
    const onMutate = vi.fn();
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: true,
      data: { retried: true },
    });

    render(
      <DownloadDuo
        {...baseProps}
        onMutate={onMutate}
        audio={{ state: "failed", jobId: 7 }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry audio/i }));

    await waitFor(() => {
      expect(onMutate).toHaveBeenCalledOnce();
    });
  });

  it("failed: shows error toast on retry failure", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "job gone" },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "failed", jobId: 7 }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry audio/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Retry failed", {
        description: "job gone",
      });
    });
  });

  it("failed: spinner persists after ok retry while slot prop is still 'failed' (optimistic gap)", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: true,
      data: { retried: true },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "failed", jobId: 7 }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry audio/i }));

    // action resolved ok but parent hasn't fed new slot data yet — spinner must stay
    await waitFor(() => {
      expect(screen.getByLabelText("audio download queued")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /retry audio/i })).not.toBeInTheDocument();
    });
  });

  it("failed: retry button returns when retry action fails (no optimistic gap on failure)", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: false,
      error: { code: "NOT_FOUND", message: "job gone" },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "failed", jobId: 7 }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry audio/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry audio/i })).toBeInTheDocument();
    });
  });
});

describe("DownloadDuo – video slot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("present: renders solid icon with ok-color class and correct aria-label", () => {
    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "present", format: "mp4" }}
      />,
    );
    const el = screen.getByLabelText("video downloaded (mp4)");
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/color-ok/);
  });

  it("missing + canDownload: enabled button calls downloadVideoAction with 'video'", async () => {
    vi.spyOn(videoActions, "downloadVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 2 },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "missing" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /download video/i }));

    await waitFor(() => {
      expect(videoActions.downloadVideoAction).toHaveBeenCalledWith(42, "video");
    });
  });

  it("failed: button triggers retryJobAction with correct jobId", async () => {
    vi.spyOn(jobActions, "retryJobAction").mockResolvedValue({
      ok: true,
      data: { retried: true },
    });

    render(
      <DownloadDuo
        {...baseProps}
        audio={{ state: "missing" }}
        video={{ state: "failed", jobId: 99 }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /retry video/i }));

    await waitFor(() => {
      expect(jobActions.retryJobAction).toHaveBeenCalledWith(99);
    });
  });
});
