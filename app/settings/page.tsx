import { Suspense } from "react";
import { ensureBooted } from "@/lib/boot";
import { SelfCheckBanner } from "@/components/self-check-banner";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GeneralSection } from "@/components/settings/general-section";
import { StorageSection } from "@/components/settings/storage-section";
import { AudioSection } from "@/components/settings/audio-section";
import { VideoSection } from "@/components/settings/video-section";
import { SyncSection } from "@/components/settings/sync-section";
import { AdvancedSection } from "@/components/settings/advanced-section";
import { SkeletonRow } from "@/components/shared/skeleton-row";

export default async function SettingsPage() {
  const ctx = await ensureBooted();
  const s = ctx.settingsService;
  const initial = {
    audioStoragePath: s.getAudioStoragePath(),
    videoStoragePath: s.getVideoStoragePath(),
    useSingleStoragePath: s.getUseSingleStoragePath(),
    defaultAudioFormat: s.getDefaultAudioFormat(),
    defaultAudioBitrate: s.getDefaultAudioBitrate(),
    defaultVideoQuality: s.getDefaultVideoQuality(),
    embedThumbnails: s.getEmbedThumbnails(),
    globalSyncCron: s.getGlobalSyncCron(),
    syncOnStartup: s.getSyncOnStartup(),
    concurrency: s.getConcurrency(),
    ytdlpPath: s.getYtdlpPath(),
    ffmpegPath: s.getFfmpegPath(),
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure storage paths, formats, sync schedule and external tools.
        </p>
      </header>
      <SelfCheckBanner />
      <Suspense fallback={<SkeletonRow />}>
        <SettingsTabs
          general={<GeneralSection />}
          storage={<StorageSection initial={initial} />}
          audio={<AudioSection initial={initial} />}
          video={<VideoSection initial={initial} />}
          sync={<SyncSection initial={initial} />}
          advanced={<AdvancedSection initial={initial} />}
        />
      </Suspense>
    </div>
  );
}
