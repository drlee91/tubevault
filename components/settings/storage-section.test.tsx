import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/settings-actions";
import { StorageSection } from "./storage-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// StorageUsageDisplay uses SWR; mock it to avoid fetch
vi.mock("./storage-usage-display", () => ({
  StorageUsageDisplay: () => <div data-testid="storage-usage-display" />,
}));

const defaultProps = {
  initial: {
    audioStoragePath: "/data/audio",
    videoStoragePath: "/data/video",
    useSingleStoragePath: false,
  },
};

describe("StorageSection", () => {
  it("submits values and shows success toast", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<StorageSection {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        audioStoragePath: "/data/audio",
        videoStoragePath: "/data/video",
        useSingleStoragePath: false,
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"));
  });

  it("shows inline error on STORAGE_PATH_INVALID for audioStoragePath", async () => {
    vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: false,
      error: {
        code: "STORAGE_PATH_INVALID",
        message: "Audio path is not writable",
        field: "audioStoragePath",
      },
    });

    render(<StorageSection {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/audio path is not writable/i)).toBeInTheDocument();
  });

  it("disables video path input when useSingleStoragePath is true", () => {
    render(
      <StorageSection
        initial={{ audioStoragePath: "/a", videoStoragePath: "/v", useSingleStoragePath: true }}
      />,
    );
    const videoInput = screen.getByPlaceholderText("/data/video");
    expect(videoInput).toBeDisabled();
  });
});
