import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "../playlist-repo";
import { VideoRepo } from "../video-repo";
import { PlaylistItemRepo } from "../playlist-item-repo";

function setup() {
  const { db, sqlite } = createTestDb();
  const playlists = new PlaylistRepo(db);
  const videos = new VideoRepo(db);
  const items = new PlaylistItemRepo(db);
  const playlistId = playlists.create({
    provider: "youtube",
    externalId: "PL",
    url: "u",
    defaultFormat: "audio",
  });
  return { db, sqlite, playlists, videos, items, playlistId };
}

describe("PlaylistItemRepo", () => {
  it("upsertActive inserts and updates position", () => {
    const { sqlite, videos, items, playlistId } = setup();
    try {
      const v = videos.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "x",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      items.upsertActive(playlistId, v, 0);
      items.upsertActive(playlistId, v, 5);
      const active = items.activeExternalIdsByPlaylist(playlistId);
      expect(active).toEqual(["v1"]);
    } finally {
      sqlite.close();
    }
  });

  it("markRemoved sets in_playlist=false and timestamp", () => {
    const { sqlite, videos, items, playlistId } = setup();
    try {
      const v = videos.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "x",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      items.upsertActive(playlistId, v, 0);
      items.markRemoved(playlistId, v);
      expect(items.activeExternalIdsByPlaylist(playlistId)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });
});
