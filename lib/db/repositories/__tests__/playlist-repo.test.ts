import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "../playlist-repo";

describe("PlaylistRepo", () => {
  it("inserts and reads back a playlist", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({
        provider: "youtube",
        externalId: "PL1",
        url: "https://www.youtube.com/playlist?list=PL1",
        defaultFormat: "audio",
      });
      const row = repo.byId(id);
      expect(row).toMatchObject({
        provider: "youtube",
        externalId: "PL1",
        defaultFormat: "audio",
        syncEnabled: true,
      });
    } finally {
      sqlite.close();
    }
  });

  it("byProviderExternalId looks up by natural key", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      expect(repo.byProviderExternalId("youtube", "PL1")).not.toBeNull();
      expect(repo.byProviderExternalId("youtube", "missing")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("touchLastSyncedAt updates the timestamp", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      repo.touchLastSyncedAt(id);
      const row = repo.byId(id)!;
      expect(row.lastSyncedAt).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("delete removes the row", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      repo.delete(id);
      expect(repo.byId(id)).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("list returns all playlists", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      repo.create({ provider: "youtube", externalId: "PL1", url: "u1", defaultFormat: "audio" });
      repo.create({ provider: "youtube", externalId: "PL2", url: "u2", defaultFormat: "video" });
      expect(repo.list()).toHaveLength(2);
    } finally {
      sqlite.close();
    }
  });
});
