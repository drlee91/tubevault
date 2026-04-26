import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "@/tests/helpers/db";
import { SettingsRepository } from "./settings-repo";

let testDb: TestDb;
let repo: SettingsRepository;

beforeEach(() => {
  testDb = createTestDb();
  repo = new SettingsRepository(testDb.db);
});

afterEach(() => {
  testDb.close();
});

describe("SettingsRepository", () => {
  it("returns null for unknown keys", () => {
    expect(repo.get("missing_key")).toBeNull();
  });

  it("stores and retrieves a string value", () => {
    repo.set("greeting", "hello");
    expect(repo.get<string>("greeting")).toBe("hello");
  });

  it("stores and retrieves a structured object", () => {
    const value = { audio: 320, video: "1080p" };
    repo.set("formats", value);
    expect(repo.get<typeof value>("formats")).toEqual(value);
  });

  it("overwrites existing values on set", () => {
    repo.set("k", "v1");
    repo.set("k", "v2");
    expect(repo.get<string>("k")).toBe("v2");
  });

  it("deletes a key", () => {
    repo.set("k", "v");
    repo.delete("k");
    expect(repo.get("k")).toBeNull();
  });

  it("lists all keys with values", () => {
    repo.set("a", 1);
    repo.set("b", "two");
    const all = repo.getAll();
    expect(all).toEqual({ a: 1, b: "two" });
  });

  it("returns the updatedAt timestamp", () => {
    repo.set("k", "v");
    const meta = repo.getWithMeta("k");
    expect(meta).not.toBeNull();
    expect(meta!.updatedAt).toBeInstanceOf(Date);
  });
});
