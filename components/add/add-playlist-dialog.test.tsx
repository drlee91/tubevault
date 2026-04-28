import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/playlist-actions";
import { AddPlaylistDialog } from "./add-playlist-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("AddPlaylistDialog", () => {
  it("submits and closes on success", async () => {
    const spy = vi.spyOn(actions, "addPlaylistAction").mockResolvedValue({
      ok: true, data: { playlistId: 7, syncJobId: 1 },
    });
    const onOpenChange = vi.fn();
    render(<AddPlaylistDialog open onOpenChange={onOpenChange} />);
    await userEvent.type(screen.getByLabelText(/url/i), "https://www.youtube.com/playlist?list=PL1");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(spy).toHaveBeenCalled();
    // Wait microtask
    await Promise.resolve();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows inline error for URL_NOT_PLAYLIST", async () => {
    vi.spyOn(actions, "addPlaylistAction").mockResolvedValue({
      ok: false, error: { code: "URL_NOT_PLAYLIST", message: "Not a playlist" },
    });
    render(<AddPlaylistDialog open onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/url/i), "https://youtu.be/abc");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(await screen.findByText(/not a playlist/i)).toBeInTheDocument();
  });
});
