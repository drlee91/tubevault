import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as actions from "@/lib/actions/settings-actions";
import { AudioSection } from "./audio-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const defaultProps = {
  initial: {
    defaultAudioFormat: "mp3" as const,
    defaultAudioBitrate: "192" as const,
    embedThumbnails: false,
  },
};

describe("AudioSection", () => {
  it("submits selected format + bitrate + embedThumbnails toggled → action called with full payload, toast success", async () => {
    const spy = vi.spyOn(actions, "updateSettingsAction").mockResolvedValue({
      ok: true,
      data: { updated: true },
    });
    const { toast } = await import("sonner");

    render(<AudioSection {...defaultProps} />);

    // Change audio format from mp3 to opus
    const [formatCombobox, bitrateCombobox] = screen.getAllByRole("combobox");
    await userEvent.click(formatCombobox!);
    await userEvent.click(await screen.findByText("Opus"));

    // Change audio bitrate from 192 to 320
    await userEvent.click(bitrateCombobox!);
    await userEvent.click(await screen.findByText("320 kbps"));

    // Toggle embedThumbnails switch on
    const switchEl = screen.getByRole("switch");
    await userEvent.click(switchEl);

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultAudioFormat: "opus",
        defaultAudioBitrate: "320",
        embedThumbnails: true,
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Settings saved"),
    );
  });

  it("renders initial values from props", () => {
    render(
      <AudioSection
        initial={{
          defaultAudioFormat: "flac",
          defaultAudioBitrate: "320",
          embedThumbnails: true,
        }}
      />,
    );

    // base-ui SelectValue renders the raw value string in the trigger
    const [formatCombobox, bitrateCombobox] = screen.getAllByRole("combobox");
    expect(formatCombobox).toHaveTextContent("flac");
    expect(bitrateCombobox).toHaveTextContent("320");

    // Switch should be checked
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });
});
