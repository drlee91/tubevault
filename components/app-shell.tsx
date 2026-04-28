import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { PlayerProvider } from "./player/player-provider";
import { PlayerBar } from "./player/player-bar";
import { QueueSidebar } from "./player/queue-sidebar";
import { QueueDrawer } from "./player/queue-drawer";
import { FullscreenAudio } from "./player/fullscreen-audio";
import { FullscreenVideo } from "./player/fullscreen-video";
import { MobilePlayerSheet } from "./player/mobile-sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="flex min-h-dvh flex-col @container">
        <Topbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 overflow-auto pb-32 md:pb-20">{children}</main>
          <QueueSidebar />
        </div>
        {/* Desktop bar (hidden on < md, mobile sheet replaces it). */}
        <div className="hidden md:block"><PlayerBar /></div>
        <BottomNav />
        <MobilePlayerSheet />
        <QueueDrawer />
        <FullscreenAudio />
        <FullscreenVideo />
      </div>
    </PlayerProvider>
  );
}
