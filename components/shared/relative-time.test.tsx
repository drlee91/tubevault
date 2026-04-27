import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelativeTime } from "./relative-time";

describe("RelativeTime", () => {
  const now = new Date("2026-04-26T12:00:00Z").getTime();

  it("renders 'just now' for <30s", () => {
    render(<RelativeTime iso="2026-04-26T11:59:50Z" nowMs={now} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders minutes", () => {
    render(<RelativeTime iso="2026-04-26T11:55:00Z" nowMs={now} />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("renders hours", () => {
    render(<RelativeTime iso="2026-04-26T09:00:00Z" nowMs={now} />);
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it("renders days", () => {
    render(<RelativeTime iso="2026-04-23T12:00:00Z" nowMs={now} />);
    expect(screen.getByText("3d ago")).toBeInTheDocument();
  });

  it("renders 'never' for null", () => {
    render(<RelativeTime iso={null} nowMs={now} />);
    expect(screen.getByText("never")).toBeInTheDocument();
  });
});
