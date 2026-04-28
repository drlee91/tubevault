import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneralSection } from "./general-section";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: mockSetTheme }),
}));

describe("GeneralSection", () => {
  it("renders theme select with current theme value", () => {
    render(<GeneralSection />);
    // base-ui SelectValue renders the raw value string in the trigger
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("dark");
  });

  it("calls setTheme when a new option is selected", async () => {
    mockSetTheme.mockClear();
    render(<GeneralSection />);
    // Open the select
    await userEvent.click(screen.getByRole("combobox"));
    // Click the Light option
    await userEvent.click(await screen.findByText("Light"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
