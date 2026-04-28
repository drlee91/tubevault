import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SelfCheckBanner } from "./self-check-banner";
import type { SelfCheckResult } from "@/lib/services/self-check-service";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function mockFetchWith(data: SelfCheckResult) {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const okResult: SelfCheckResult = {
  overall: "ok",
  checks: [
    { name: "yt-dlp", status: "ok", detail: "2026.04.01" },
    { name: "ffmpeg", status: "ok", detail: "ffmpeg version 6.0" },
    { name: "audio_storage", status: "ok", detail: "/data/audio" },
    { name: "video_storage", status: "ok", detail: "/data/video" },
    { name: "database", status: "ok", detail: "/data/tubevault.db" },
  ],
};

const errorResult: SelfCheckResult = {
  overall: "error",
  checks: [
    { name: "yt-dlp", status: "error", detail: "not found or not executable" },
    { name: "ffmpeg", status: "ok", detail: "ffmpeg version 6.0" },
    { name: "audio_storage", status: "warn", detail: "/data/audio: permission denied" },
    { name: "video_storage", status: "ok", detail: "/data/video" },
    { name: "database", status: "warn", detail: "not yet created at /data/tubevault.db (will be created on first migration)" },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SelfCheckBanner", () => {
  it("renders checking badge initially before fetch resolves", () => {
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}));
    render(<SelfCheckBanner />);
    expect(screen.getByText("checking…")).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));
    render(<SelfCheckBanner />);
    expect(await screen.findByText("unreachable")).toBeInTheDocument();
    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  it("renders Configure link pointing to /settings?tab=advanced when yt-dlp check is error", async () => {
    mockFetchWith(errorResult);
    render(<SelfCheckBanner />);

    const configureLinks = await screen.findAllByRole("link", { name: "Configure" });
    const hrefs = configureLinks.map((l) => l.getAttribute("href"));

    expect(hrefs).toContain("/settings?tab=advanced");
  });

  it("renders no Configure link for ok-status checks", async () => {
    mockFetchWith(okResult);
    render(<SelfCheckBanner />);

    // Wait for data to load — all checks are "ok" so multiple spans appear
    await screen.findAllByText("ok", { selector: "span" });

    expect(screen.queryByRole("link", { name: "Configure" })).toBeNull();
  });

  it("renders no Configure link for database check even when warn", async () => {
    mockFetchWith(errorResult);
    render(<SelfCheckBanner />);

    // Wait for data to load
    const configureLinks = await screen.findAllByRole("link", { name: "Configure" });

    // Only yt-dlp (advanced) and audio_storage (storage) should have Configure links
    const hrefs = configureLinks.map((l) => l.getAttribute("href"));
    expect(hrefs).not.toContain(expect.stringContaining("database"));
    // Exactly 2 links: one for yt-dlp (advanced), one for audio_storage (storage)
    expect(hrefs).toHaveLength(2);
    expect(hrefs).toContain("/settings?tab=advanced");
    expect(hrefs).toContain("/settings?tab=storage");
  });
});
