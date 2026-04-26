import { describe, it, expect } from "vitest";
import { backoffMs } from "./backoff";

describe("backoffMs", () => {
  it("returns 1s for first retry (attempts=1)", () => {
    expect(backoffMs(1)).toBe(1_000);
  });
  it("returns 4s for second retry", () => {
    expect(backoffMs(2)).toBe(4_000);
  });
  it("returns 16s for third retry", () => {
    expect(backoffMs(3)).toBe(16_000);
  });
  it("caps at 1 hour", () => {
    expect(backoffMs(20)).toBe(3_600_000);
  });
  it("returns 0 for attempts <= 0", () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(-1)).toBe(0);
  });
});
