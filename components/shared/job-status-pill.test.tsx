import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobStatusPill } from "./job-status-pill";

describe("JobStatusPill", () => {
  it.each([
    ["queued", "queued"],
    ["running", "running"],
    ["completed", "completed"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
    ["partial", "partial"],
  ] as const)("renders %s", (status, label) => {
    render(<JobStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
