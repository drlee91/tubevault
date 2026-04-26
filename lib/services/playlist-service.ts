import type { PlaylistRepo, PlaylistRow } from "@/lib/db/repositories/playlist-repo";
import type { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import type { JobQueue } from "@/lib/jobs/queue";
import type { ProviderRegistry } from "@/lib/providers/registry";

export class ProviderUnsupportedError extends Error {
  constructor(public readonly url: string) {
    super(`no provider for ${url}`);
    this.name = "ProviderUnsupportedError";
  }
}

export class UrlNotPlaylistError extends Error {
  constructor(public readonly url: string) {
    super(`url is not a playlist: ${url}`);
    this.name = "UrlNotPlaylistError";
  }
}

export class PlaylistAlreadyTrackedError extends Error {
  constructor(public readonly playlistId: number) {
    super(`playlist already tracked: ${playlistId}`);
    this.name = "PlaylistAlreadyTrackedError";
  }
}

export interface CreatePlaylistInput {
  url: string;
  defaultFormat: "audio" | "video";
}

export interface PlaylistServiceDeps {
  playlistRepo: PlaylistRepo;
  itemRepo: PlaylistItemRepo;
  queue: JobQueue;
  registry: ProviderRegistry;
}

export class PlaylistService {
  constructor(private readonly d: PlaylistServiceDeps) {}

  async create(input: CreatePlaylistInput): Promise<{ playlist: PlaylistRow; syncJobId: number }> {
    const adapter = this.d.registry.findByUrl(input.url);
    if (!adapter) throw new ProviderUnsupportedError(input.url);
    const parsed = adapter.parseUrl(input.url);
    if (!parsed || parsed.kind !== "playlist") throw new UrlNotPlaylistError(input.url);
    const existing = this.d.playlistRepo.byProviderExternalId(adapter.provider, parsed.externalId);
    if (existing) throw new PlaylistAlreadyTrackedError(existing.id);
    const id = this.d.playlistRepo.create({
      provider: adapter.provider,
      externalId: parsed.externalId,
      url: input.url,
      defaultFormat: input.defaultFormat,
    });
    const playlist = this.d.playlistRepo.byId(id)!;
    const syncJobId = await this.d.queue.enqueue(
      "sync_playlist",
      { playlistId: id },
      { priority: 10 },
    );
    return { playlist, syncJobId };
  }

  list(): PlaylistRow[] {
    return this.d.playlistRepo.list();
  }

  byId(id: number): PlaylistRow | null {
    return this.d.playlistRepo.byId(id);
  }

  async delete(id: number): Promise<void> {
    this.d.itemRepo.deleteByPlaylist(id);
    this.d.playlistRepo.delete(id);
  }
}
