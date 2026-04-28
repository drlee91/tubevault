import { describe, it, expect } from "vitest";
import { fromPlaylistDetailItems, fromStandaloneVideos } from "./queue-from-items";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import type { VideoSerialized } from "@/lib/client/use-standalone-videos";

function detailItem(over: Partial<PlaylistDetailItem> = {}): PlaylistDetailItem {
  return {
    position: 0, inPlaylist: true, addedAt: "x", removedFromPlaylistAt: null,
    video: {
      id: 1, externalId: "v1", title: "Title", channelTitle: "Chan",
      durationSeconds: 60, thumbnailUrl: "u", availabilityStatus: "available", availabilityReason: null,
    },
    audioFile: null, videoFile: null, pendingJob: null,
    availableKinds: ["audio"],
    ...over,
  };
}

describe("fromPlaylistDetailItems", () => {
  it("maps fields and sets defaultKind from playlist defaultFormat", () => {
    const out = fromPlaylistDetailItems([detailItem({ video: { ...detailItem().video, id: 5 } })], "audio");
    expect(out[0]!.videoId).toBe(5);
    expect(out[0]!.defaultKind).toBe("audio");
    expect(out[0]!.title).toBe("Title");
    expect(out[0]!.availableKinds).toEqual(["audio"]);
  });
});

describe("fromStandaloneVideos", () => {
  it("uses 'audio' as defaultKind when audio is available, else 'video'", () => {
    const v: VideoSerialized = {
      id: 9, provider: "youtube", externalId: "x", title: "T",
      channelTitle: null, channelId: null, durationSeconds: 60, thumbnailUrl: null,
      availabilityStatus: "available", availabilityReason: null,
      availabilityChangedAt: null, firstSeenAt: "x", lastSeenAt: "x",
      createdAt: "x", updatedAt: "x",
      availableKinds: ["video"],
    };
    const out = fromStandaloneVideos([v]);
    expect(out[0]!.defaultKind).toBe("video");
  });
});
