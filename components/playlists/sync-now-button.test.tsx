import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/playlist-actions";
import { SyncNowButton } from "./sync-now-button";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("SyncNowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls syncPlaylistAction on click and toasts success", async () => {
    const spy = vi.spyOn(actions, "syncPlaylistAction").mockResolvedValue({
      ok: true,
      data: { syncJobId: 1 },
    });

    render(<SyncNowButton playlistId={42} />);
    await userEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(42);
    expect(toast.success).toHaveBeenCalledWith("Sync queued");
  });

  it("shows error toast on failure", async () => {
    vi.spyOn(actions, "syncPlaylistAction").mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "boom" },
    });

    render(<SyncNowButton playlistId={42} />);
    await userEvent.click(screen.getByRole("button", { name: /sync now/i }));

    await Promise.resolve();

    expect(toast.error).toHaveBeenCalledWith("Sync failed", { description: "boom" });
  });

  it("respects disabled prop", () => {
    render(<SyncNowButton playlistId={42} disabled={true} />);
    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
  });
});
