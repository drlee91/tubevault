import type { PlayerStore } from "./store";

export function attachKeyboard(store: PlayerStore): () => void {
  function handler(ev: KeyboardEvent) {
    const t = ev.target as HTMLElement | null;
    if (t) {
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable) return;
    }
    const s = store.getState();
    switch (ev.key) {
      case " ":
      case "Spacebar":
        ev.preventDefault();
        s.togglePlay();
        return;
      case "ArrowRight":
        ev.preventDefault();
        if (ev.shiftKey) s.next();
        else s.seek(s.position + 10);
        return;
      case "ArrowLeft":
        ev.preventDefault();
        if (ev.shiftKey) s.prev();
        else s.seek(Math.max(0, s.position - 10));
        return;
      case "m":
      case "M":
        ev.preventDefault();
        s.toggleMute();
        return;
      case "f":
      case "F":
        ev.preventDefault();
        s.openFullscreen();
        return;
    }
  }
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
