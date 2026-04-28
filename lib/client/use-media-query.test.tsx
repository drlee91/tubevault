import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./use-media-query";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockMatchMedia(matches: boolean) {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  const mql = {
    matches,
    media: "(min-width: 768px)",
    addEventListener: vi.fn((_: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn((_: string, handler: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
  } as unknown as MediaQueryList & { _listeners: typeof listeners };

  (mql as any)._listeners = listeners;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });

  return mql as unknown as MediaQueryList & { _listeners: typeof listeners };
}

describe("useMediaQuery", () => {
  it("returns initial match value from window.matchMedia(...).matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("updates when matchMedia fires 'change' event", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => {
      for (const handler of (mql as any)._listeners) {
        handler({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(result.current).toBe(true);
  });

  it("cleans up listener on unmount", () => {
    const mql = mockMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect((mql as unknown as { addEventListener: ReturnType<typeof vi.fn> }).addEventListener).toHaveBeenCalledOnce();

    unmount();

    expect((mql as unknown as { removeEventListener: ReturnType<typeof vi.fn> }).removeEventListener).toHaveBeenCalledOnce();
  });
});
