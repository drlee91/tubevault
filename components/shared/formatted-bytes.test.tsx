import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormattedBytes } from "./formatted-bytes";

describe("FormattedBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1024 * 1024, "1.0 MB"],
    [1024 * 1024 * 1024, "1.0 GB"],
    [1.5 * 1024 * 1024 * 1024, "1.5 GB"],
  ])("formats %d as %s", (bytes, expected) => {
    render(<FormattedBytes bytes={bytes} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
