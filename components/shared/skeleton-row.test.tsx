import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SkeletonRow } from "./skeleton-row";

describe("SkeletonRow", () => {
  it("renders 8 rows by default", () => {
    const { container } = render(<SkeletonRow />);
    expect(container.querySelectorAll("[data-slot='skeleton-row']")).toHaveLength(8);
  });

  it("respects count prop", () => {
    const { container } = render(<SkeletonRow count={3} />);
    expect(container.querySelectorAll("[data-slot='skeleton-row']")).toHaveLength(3);
  });
});
