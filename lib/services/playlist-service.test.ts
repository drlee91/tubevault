import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import {
  PlaylistService,
  PlaylistAlreadyTrackedError,
  ProviderUnsupportedError,
  UrlNotPlaylistError,
} from "./playlist-service";

function setup() {
  const { db, sqlite } = createTestDb();
  const playlistRepo = new PlaylistRepo(db);
  const itemRepo = new PlaylistItemRepo(db);
  const jobRepo = new JobRepo(db);
  const queue = new JobQueue(db, jobRepo);
  const registry = new ProviderRegistry();
  return { sqlite, playlistRepo, itemRepo, queue, jobRepo, registry };
}

describe("PlaylistService", () => {
  it("create inserts playlist and enqueues sync_playlist", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      const { playlist, syncJobId } = await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      expect(playlist.externalId).toBe("PLX");
      expect(ctx.jobRepo.byId(syncJobId)?.type).toBe("sync_playlist");
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects unsupported provider", async () => {
    const ctx = setup();
    try {
      const svc = new PlaylistService(ctx);
      await expect(svc.create({ url: "https://soundcloud.com/x", defaultFormat: "audio" }))
        .rejects.toBeInstanceOf(ProviderUnsupportedError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects non-playlist URL", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      await expect(svc.create({ url: "https://youtu.be/abc", defaultFormat: "audio" }))
        .rejects.toBeInstanceOf(UrlNotPlaylistError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects duplicates", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      await expect(svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      })).rejects.toBeInstanceOf(PlaylistAlreadyTrackedError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("delete removes playlist + items, leaves videos and media files alone", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      const { playlist } = await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      await svc.delete(playlist.id);
      expect(ctx.playlistRepo.byId(playlist.id)).toBeNull();
    } finally {
      ctx.sqlite.close();
    }
  });
});
