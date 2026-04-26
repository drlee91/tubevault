import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { homedir } from "node:os";
import path from "node:path";
import { createTestDb, type TestDb } from "@/tests/helpers/db";
import { SettingsRepository } from "@/lib/db/repositories/settings-repo";
import { SettingsService } from "./settings-service";

let testDb: TestDb;
let service: SettingsService;

beforeEach(() => {
  testDb = createTestDb();
  service = new SettingsService(new SettingsRepository(testDb.db));
});

afterEach(() => {
  testDb.close();
});

describe("SettingsService", () => {
  it("returns default audio storage path when unset", () => {
    expect(service.getAudioStoragePath()).toBe(path.join(homedir(), "Music", "TubeVault"));
  });

  it("returns default video storage path when unset", () => {
    expect(service.getVideoStoragePath()).toBe(path.join(homedir(), "Videos", "TubeVault"));
  });

  it("persists and reads back audio storage path", () => {
    service.setAudioStoragePath("/custom/audio");
    expect(service.getAudioStoragePath()).toBe("/custom/audio");
  });

  it("rejects empty storage paths", () => {
    expect(() => service.setAudioStoragePath("")).toThrow();
  });

  it("returns default audio format mp3 when unset", () => {
    expect(service.getDefaultAudioFormat()).toBe("mp3");
  });

  it("rejects invalid audio formats", () => {
    expect(() => service.setDefaultAudioFormat("wav" as never)).toThrow();
  });

  it("returns default concurrency 3 when unset", () => {
    expect(service.getConcurrency()).toBe(3);
  });

  it("clamps concurrency to range 1..10", () => {
    expect(() => service.setConcurrency(0)).toThrow();
    expect(() => service.setConcurrency(11)).toThrow();
    service.setConcurrency(5);
    expect(service.getConcurrency()).toBe(5);
  });

  it("returns default theme system when unset", () => {
    expect(service.getTheme()).toBe("system");
  });

  it("returns boolean flags with documented defaults", () => {
    expect(service.getEmbedThumbnails()).toBe(true);
    expect(service.getUseSingleStoragePath()).toBe(false);
    expect(service.getSyncOnStartup()).toBe(false);
  });
});
