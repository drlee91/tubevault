import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/video-actions";
import { AddVideoDialog } from "./add-video-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("AddVideoDialog", () => {
  it("submits and closes on success", async () => {
    const spy = vi.spyOn(actions, "addVideoAction").mockResolvedValue({
      ok: true, data: { videoId: 9, downloadJobId: 2 },
    });
    const onOpenChange = vi.fn();
    render(<AddVideoDialog open onOpenChange={onOpenChange} />);
    await userEvent.type(screen.getByLabelText(/url/i), "https://www.youtube.com/watch?v=abc123");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(spy).toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows inline error and 'Add as playlist instead' for URL_NOT_VIDEO", async () => {
    vi.spyOn(actions, "addVideoAction").mockResolvedValue({
      ok: false, error: { code: "URL_NOT_VIDEO", message: "Not a video URL" },
    });
    const onOpenChange = vi.fn();
    const onSwitchToPlaylist = vi.fn();
    render(
      <AddVideoDialog open onOpenChange={onOpenChange} onSwitchToPlaylist={onSwitchToPlaylist} />,
    );
    await userEvent.type(screen.getByLabelText(/url/i), "https://www.youtube.com/playlist?list=PL1");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(await screen.findByText(/not a video url/i)).toBeInTheDocument();
    const switchBtn = screen.getByRole("button", { name: /add as playlist/i });
    expect(switchBtn).toBeInTheDocument();
    await userEvent.click(switchBtn);
    expect(onSwitchToPlaylist).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
