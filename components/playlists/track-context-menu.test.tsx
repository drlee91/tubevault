import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as videoActions from "@/lib/actions/video-actions";
import { TrackContextMenu } from "./track-context-menu";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("TrackContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens menu and shows all 5 items", async () => {
    render(
      <TrackContextMenu
        videoId={1}
        externalUrl="https://www.youtube.com/watch?v=abc"
        available={true}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));

    expect(await screen.findByRole("menuitem", { name: /open on youtube/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /re-download audio/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /re-download video/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /refresh availability/i })).toBeInTheDocument();
  });

  it("disables Re-download items when not available", async () => {
    render(
      <TrackContextMenu
        videoId={2}
        externalUrl="https://www.youtube.com/watch?v=xyz"
        available={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));

    const audioItem = await screen.findByRole("menuitem", { name: /re-download audio/i });
    const videoItem = screen.getByRole("menuitem", { name: /re-download video/i });

    // base-ui sets data-disabled on disabled items
    expect(audioItem).toHaveAttribute("data-disabled");
    expect(videoItem).toHaveAttribute("data-disabled");
  });

  it("calls refreshVideoAction when 'Refresh availability' clicked", async () => {
    const spy = vi.spyOn(videoActions, "refreshVideoAction").mockResolvedValue({
      ok: true,
      data: { jobId: 99 },
    });

    render(
      <TrackContextMenu
        videoId={3}
        externalUrl="https://www.youtube.com/watch?v=def"
        available={true}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /track actions/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /refresh availability/i }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(3);
    });
  });
});
