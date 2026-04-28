import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/playlist-actions";
import { DeletePlaylistButton } from "./delete-playlist-button";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { toast } from "sonner";

describe("DeletePlaylistButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes on confirm + redirects + toasts", async () => {
    const spy = vi.spyOn(actions, "deletePlaylistAction").mockResolvedValue({
      ok: true,
      data: { deleted: true },
    });

    render(<DeletePlaylistButton playlistId={7} />);

    // Click the trigger button to open the dialog
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    // Wait for dialog to appear
    await waitFor(() => {
      expect(screen.getByText("Delete playlist?")).toBeInTheDocument();
    });

    // After dialog opens the trigger is hidden behind the overlay;
    // only the confirm button matches /delete/i at this point
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(7);
      expect(toast.success).toHaveBeenCalledWith("Playlist deleted");
      expect(mockPush).toHaveBeenCalledWith("/playlists");
    });
  });

  it("error toast on failure", async () => {
    vi.spyOn(actions, "deletePlaylistAction").mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL", message: "boom" },
    });

    render(<DeletePlaylistButton playlistId={7} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete playlist?")).toBeInTheDocument();
    });

    // Only the confirm Delete button is accessible once dialog is open
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed", { description: "boom" });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("Cancel button closes dialog without deleting", async () => {
    const spy = vi.spyOn(actions, "deletePlaylistAction").mockResolvedValue({
      ok: true,
      data: { deleted: true },
    });

    render(<DeletePlaylistButton playlistId={7} />);

    // Open dialog
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByText("Delete playlist?")).toBeInTheDocument();
    });

    // Click Cancel
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(spy).not.toHaveBeenCalled();
  });
});
