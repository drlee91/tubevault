import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Duration } from "./duration";

describe("Duration", () => {
  it.each([
    [0, "0:00"],
    [9, "0:09"],
    [65, "1:05"],
    [3600, "1:00:00"],
    [3661, "1:01:01"],
    [null, "—"],
  ])("formats %s as %s", (seconds, expected) => {
    render(<Duration seconds={seconds} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
