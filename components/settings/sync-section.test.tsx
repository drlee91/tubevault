import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/settings-actions";
import { SyncSection } from "./sync-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const defaultProps = {
  initial: {
    globalSyncCron: null,
    syncOnStartup: false,
    concurrency: 2,
  },
};

describe("SyncSection", () => {
  it("selecting daily03 preset converts to cron string → action called with globalSyncCron: '0 3 * * *', toast success", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<SyncSection {...defaultProps} />);

    // Select daily03 preset
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Daily 03:00"));

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        globalSyncCron: "0 3 * * *",
        syncOnStartup: false,
        concurrency: 2,
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Settings saved"),
    );
  });

  it("concurrency = 11 shows field error and does not call action", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });

    render(<SyncSection {...defaultProps} />);

    const concurrencyInput = screen.getByRole("spinbutton");

    // Replace the existing value with 11
    await userEvent.tripleClick(concurrencyInput);
    await userEvent.keyboard("11");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    // Zod schema enforces max=10 client-side; action should NOT be called
    expect(
      await screen.findByText(/too big|maximum|must be.*10|<=\s*10/i),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });
});
