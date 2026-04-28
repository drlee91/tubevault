import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it.each([
    ["available", "available"],
    ["private", "private"],
    ["removed", "removed"],
    ["age_restricted", "age restricted"],
    ["region_blocked", "region blocked"],
    ["auth_required", "auth required"],
    ["unknown", "unknown"],
  ] as const)("renders label for %s", (status, label) => {
    render(<StatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies the right variant class for available", () => {
    render(<StatusPill status="available" data-testid="pill" />);
    const el = screen.getByTestId("pill");
    expect(el.className).toContain("status-available");
  });
});
