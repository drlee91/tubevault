import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
