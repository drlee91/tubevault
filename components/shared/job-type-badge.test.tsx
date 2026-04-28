import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobTypeBadge } from "./job-type-badge";

describe("JobTypeBadge", () => {
  it.each([
    ["sync_playlist", "sync"],
    ["download_video", "download"],
    ["check_availability", "check"],
  ] as const)("renders %s", (type, label) => {
    render(<JobTypeBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
