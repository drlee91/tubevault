"use client";
import { createContext, useContext, useRef, useSyncExternalStore } from "react";
import { initialPlayerState, type PlayerStore } from "@/lib/player/store";

const Ctx = createContext<PlayerStore | null>(null);

export function PlayerStoreProvider({ store, children }: { store: PlayerStore; children: React.ReactNode }) {
  const ref = useRef(store);
  return <Ctx.Provider value={ref.current}>{children}</Ctx.Provider>;
}

// Stable snapshot used for SSR and the first client render. Must not depend on
// the live store, otherwise mutations that happen between SSR and hydration
// (Fast Refresh survival, eager localStorage hydration) cause hydration
// mismatches. Selectors only read PlayerState fields in practice, so the cast
// to the full state+actions type is safe — calling actions on this object is
// not supported.
const SERVER_STATE = initialPlayerState as ReturnType<PlayerStore["getState"]>;

export function usePlayerStore<T>(selector: (s: ReturnType<PlayerStore["getState"]>) => T): T {
  const store = useContext(Ctx);
  if (!store) throw new Error("usePlayerStore must be used inside PlayerStoreProvider");
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store.getState()),
    () => selector(SERVER_STATE),
  );
}

export function usePlayerStoreApi(): PlayerStore {
  const store = useContext(Ctx);
  if (!store) throw new Error("usePlayerStoreApi must be used inside PlayerStoreProvider");
  return store;
}

/** Returns null when rendered outside a PlayerStoreProvider. Useful for optional player integration. */
export function usePlayerStoreApiOptional(): PlayerStore | null {
  return useContext(Ctx);
}
