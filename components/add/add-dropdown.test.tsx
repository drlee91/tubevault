import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
