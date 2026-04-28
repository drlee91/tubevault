import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/settings-actions";
import { VideoSection } from "./video-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaultProps = {
  initial: {
    defaultVideoQuality: "720p" as const,
  },
};

describe("VideoSection", () => {
  it("selecting a quality and clicking Save calls action with that quality → toast success", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<VideoSection {...defaultProps} />);

    // Change quality from 720p to 1080p
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("1080p"));

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ defaultVideoQuality: "1080p" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Settings saved"),
    );
  });

  it("renders initial value from props", () => {
    render(
      <VideoSection initial={{ defaultVideoQuality: "2160p" }} />,
    );

    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveTextContent("2160p");
  });
});
