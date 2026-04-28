import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsTabs } from "./settings-tabs";

const replace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParamsValue,
}));

describe("SettingsTabs", () => {
  beforeEach(() => {
    replace.mockClear();
    searchParamsValue = new URLSearchParams();
  });

  const defaultProps = {
    general: <div data-testid="general">General content</div>,
    storage: <div data-testid="storage">Storage content</div>,
    audio: <div data-testid="audio">Audio content</div>,
    video: <div data-testid="video">Video content</div>,
    sync: <div data-testid="sync">Sync content</div>,
    advanced: <div data-testid="advanced">Advanced content</div>,
  };

  it("defaults to general tab when no tab param", () => {
    render(<SettingsTabs {...defaultProps} />);

    const generalTab = screen.getByRole("tab", { name: /general/i });
    expect(generalTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("general")).toBeInTheDocument();
    expect(screen.queryByTestId("storage")).not.toBeInTheDocument();
  });

  it("shows audio tab when ?tab=audio", () => {
    searchParamsValue = new URLSearchParams("tab=audio");
    render(<SettingsTabs {...defaultProps} />);

    const audioTab = screen.getByRole("tab", { name: /audio/i });
    expect(audioTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("audio")).toBeInTheDocument();
    expect(screen.queryByTestId("general")).not.toBeInTheDocument();
  });

  it("calls router.replace with tab=storage when Storage tab is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsTabs {...defaultProps} />);

    await user.click(screen.getByRole("tab", { name: /storage/i }));

    expect(replace).toHaveBeenCalledWith("/settings?tab=storage");
  });
});
