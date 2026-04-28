// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createPlayerStore } from "./store";
import { attachKeyboard } from "./keyboard";

function loadOne(store: ReturnType<typeof createPlayerStore>) {
  store.getState().setQueue([
    { videoId: 1, defaultKind: "audio", title: "T1", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
    { videoId: 2, defaultKind: "audio", title: "T2", channelTitle: null, thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] },
  ], 0);
}

function press(key: string, opts: { shift?: boolean; target?: HTMLElement } = {}) {
  const ev = new KeyboardEvent("keydown", { key, shiftKey: !!opts.shift, bubbles: true, cancelable: true });
  (opts.target ?? document.body).dispatchEvent(ev);
}

let store: ReturnType<typeof createPlayerStore>;
let detach: () => void;
beforeEach(() => {
  store = createPlayerStore();
  detach = attachKeyboard(store);
  loadOne(store);
});

describe("keyboard shortcuts", () => {
  it("Space toggles play/pause", () => {
    press(" ");
    expect(store.getState().isPlaying).toBe(true);
    press(" ");
    expect(store.getState().isPlaying).toBe(false);
    detach();
  });

  it("ArrowRight seeks +10s", () => {
    store.getState().setPosition(5);
    press("ArrowRight");
    expect(store.getState().position).toBe(15);
    detach();
  });

  it("ArrowLeft seeks -10s, clamped at 0", () => {
    store.getState().setPosition(3);
    press("ArrowLeft");
    expect(store.getState().position).toBe(0);
    detach();
  });

  it("Shift+ArrowRight calls next()", () => {
    press("ArrowRight", { shift: true });
    expect(store.getState().currentIndex).toBe(1);
    detach();
  });

  it("Shift+ArrowLeft calls prev()", () => {
    store.getState().setQueue(store.getState().queue, 1);
    press("ArrowLeft", { shift: true });
    expect(store.getState().currentIndex).toBe(0);
    detach();
  });

  it("M toggles mute", () => {
    store.getState().setVolume(0.6);
    press("m");
    expect(store.getState().volume).toBe(0);
    press("M");
    expect(store.getState().volume).toBeCloseTo(0.6);
    detach();
  });

  it("F opens fullscreen when a track is loaded", () => {
    press("f");
    expect(store.getState().mode).toBe("fullscreen");
    detach();
  });

  it("ignores keypress when target is an input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    press(" ", { target: input });
    expect(store.getState().isPlaying).toBe(false);
    document.body.removeChild(input);
    detach();
  });

  it("ignores keypress when target is contentEditable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    press(" ", { target: div });
    expect(store.getState().isPlaying).toBe(false);
    document.body.removeChild(div);
    detach();
  });
});
