import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { PropsWithChildren } from "react";
import { usePlaylistDetail } from "./use-playlist-detail";

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe("usePlaylistDetail", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ playlist: { id: 1 }, items: [], recentSyncRuns: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("fetches and returns data", async () => {
    const { result } = renderHook(() => usePlaylistDetail(1, { intervalMs: 60_000 }), { wrapper });
    await waitFor(() => expect(result.current.data?.playlist.id).toBe(1));
  });

  it("uses fallbackData immediately", () => {
    const fallback = { playlist: { id: 99 }, items: [], recentSyncRuns: [] } as any;
    const { result } = renderHook(() => usePlaylistDetail(99, { fallbackData: fallback }), { wrapper });
    expect(result.current.data?.playlist.id).toBe(99);
  });
});
