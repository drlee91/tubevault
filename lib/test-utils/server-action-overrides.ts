import type { TestBootContext } from "./boot-test-context";

let overrideContext: TestBootContext | null = null;

export function __setBootContextForTesting(ctx: TestBootContext | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__setBootContextForTesting may only be called in tests");
  }
  overrideContext = ctx;
}

export function getBootContextOverride(): TestBootContext | null {
  if (process.env.NODE_ENV !== "test") return null;
  return overrideContext;
}
