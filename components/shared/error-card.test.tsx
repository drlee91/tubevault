import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorCard } from "./error-card";

describe("ErrorCard", () => {
  it("renders message", () => {
    render(<ErrorCard title="Couldn't load" message="Network error" />);
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("calls onRetry on button click", async () => {
    const onRetry = vi.fn();
    render(<ErrorCard title="Couldn't load" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
