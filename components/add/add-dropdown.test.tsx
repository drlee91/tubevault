import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as videoActions from "@/lib/actions/video-actions";
import { AddDropdown } from "./add-dropdown";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("AddDropdown", () => {
  it("opens AddPlaylistDialog when 'Add playlist' is selected", async () => {
    render(<AddDropdown />);
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /add playlist/i }));
    expect(await screen.findByRole("dialog", { name: /add playlist/i })).toBeInTheDocument();
  });

  it("opens AddVideoDialog when 'Add video' is selected", async () => {
    render(<AddDropdown />);
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /add video/i }));
    expect(await screen.findByRole("dialog", { name: /add video/i })).toBeInTheDocument();
  });

  it("switches from AddVideoDialog to AddPlaylistDialog via onSwitchToPlaylist", async () => {
    vi.spyOn(videoActions, "addVideoAction").mockResolvedValue({
      ok: false,
      error: { code: "URL_NOT_VIDEO", message: "URL is not a video" },
    });
    render(<AddDropdown />);
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /add video/i }));
    await userEvent.type(
      await screen.findByLabelText(/url/i),
      "https://www.youtube.com/playlist?list=PL1",
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /add as playlist instead/i }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /add playlist/i })).toBeInTheDocument(),
    );
  });
});
