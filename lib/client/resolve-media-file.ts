"use client";

export interface MediaFileMap { audio: number | null; video: number | null; }

export interface MediaFileResolver {
  /**
   * Returns:
   * - `number`    → file found
   * - `null`      → cached; file definitively not available
   * - `undefined` → not yet cached (fetch not yet started or complete)
   */
  get(videoId: number, kind: "audio" | "video"): number | null | undefined;
  fetchAndCache(videoId: number): Promise<MediaFileMap>;
}

export function createMediaFileResolver(): MediaFileResolver {
  const cache = new Map<number, MediaFileMap>();
  const inflight = new Map<number, Promise<MediaFileMap>>();
  return {
    get(videoId, kind) {
      const entry = cache.get(videoId);
      if (!entry) return undefined; // not yet in cache
      return entry[kind]; // number or null
    },
    async fetchAndCache(videoId) {
      const existing = cache.get(videoId);
      if (existing) return existing;
      let promise = inflight.get(videoId);
      if (!promise) {
        promise = fetch(`/api/videos/${videoId}/media-files`).then(async (r) => {
          if (!r.ok) return { audio: null, video: null } as MediaFileMap;
          return (await r.json()) as MediaFileMap;
        });
        inflight.set(videoId, promise);
      }
      const result = await promise;
      cache.set(videoId, result);
      inflight.delete(videoId);
      return result;
    },
  };
}
