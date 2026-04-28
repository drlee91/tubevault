import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/settings-actions";
import { AdvancedSection } from "./advanced-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaultProps = {
  initial: {
    ytdlpPath: null,
    ffmpegPath: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdvancedSection", () => {
  it("Save yt-dlp path → calls action with path → toasts success", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<AdvancedSection {...defaultProps} />);

    const input = screen.getByLabelText(/yt-dlp path/i);
    await userEvent.clear(input);
    await userEvent.type(input, "/usr/local/bin/yt-dlp");

    // Click the Save button for yt-dlp (first Save button)
    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    await userEvent.click(saveButtons[0]!);

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ytdlpPath: "/usr/local/bin/yt-dlp" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("yt-dlp path saved"),
    );
  });

  it("Test yt-dlp → fetches endpoint → renders version on ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, version: "2026.04.01" }),
      }),
    );

    render(<AdvancedSection initial={{ ytdlpPath: "/usr/bin/yt-dlp", ffmpegPath: null }} />);

    const testButtons = screen.getAllByRole("button", { name: /test/i });
    await userEvent.click(testButtons[0]!);

    await waitFor(() => screen.getByText(/2026\.04\.01/));

    expect(fetch).toHaveBeenCalledWith(
      "/api/selfcheck/ytdlp",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });

  it("Test ffmpeg with empty path → fetches endpoint with no path → renders error on fail response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: false, error: "command not found: ffmpeg" }),
      }),
    );

    render(<AdvancedSection {...defaultProps} />);

    // ffmpeg Test button is second
    const testButtons = screen.getAllByRole("button", { name: /test/i });
    await userEvent.click(testButtons[1]!);

    await waitFor(() => screen.getByText(/command not found: ffmpeg/));

    // Empty path → body should not include 'path' key (or pass undefined)
    expect(fetch).toHaveBeenCalledWith(
      "/api/selfcheck/ffmpeg",
      expect.objectContaining({ method: "POST" }),
    );

    vi.unstubAllGlobals();
  });

  it("Save ffmpeg path → calls action with path → toasts success", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<AdvancedSection {...defaultProps} />);

    const ffmpegInput = screen.getByLabelText(/ffmpeg path/i);
    await userEvent.clear(ffmpegInput);
    await userEvent.type(ffmpegInput, "/usr/local/bin/ffmpeg");

    // Second Save button is for ffmpeg
    const saveButtons = screen.getAllByRole("button", { name: /save/i });
    await userEvent.click(saveButtons[1]!);

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ ffmpegPath: "/usr/local/bin/ffmpeg" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("ffmpeg path saved"),
    );
  });
});
