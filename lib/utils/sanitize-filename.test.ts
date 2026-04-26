import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "./sanitize-filename";

describe("sanitizeFilename", () => {
  it("replaces path-unsafe characters", () => {
    expect(sanitizeFilename('a/b\\c:d<e>f|g?h*i"j')).toBe("a-b-c-d-e-f-g-h-i-j");
  });
  it("collapses internal whitespace", () => {
    expect(sanitizeFilename("a   b\t\nc")).toBe("a b c");
  });
  it("strips leading and trailing dots and spaces", () => {
    expect(sanitizeFilename(" .  hello  . ")).toBe("hello");
  });
  it("caps length at 200 characters", () => {
    expect(sanitizeFilename("x".repeat(500))).toHaveLength(200);
  });
  it("preserves Unicode letters and digits", () => {
    expect(sanitizeFilename("Tëst Müsïk - 2024")).toBe("Tëst Müsïk - 2024");
  });
  it("returns empty string for input that sanitizes to nothing", () => {
    expect(sanitizeFilename("...   ")).toBe("");
  });
});
