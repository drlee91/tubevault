# Plan 4 Follow-ups

_Aufgezeichnet nach Abschluss von Plan 4 (2026-04-28)._

## Architektur-Entscheidungen die dokumentiert wurden

- **Zustand 5 statt 4:** Das Projekt hatte bereits Zustand 5 installiert. `createStore` aus `zustand/vanilla` + `StoreApi` aus `zustand/vanilla` wird korrekt verwendet.
- **`usePlayerStoreApiOptional()`:** Wurde hinzugefügt (nicht im ursprünglichen Spec), weil Playlist-Komponenten außerhalb des Providers gerendert werden können (z.B. Tests, Storybook). Wenn der PlayerProvider immer in der AppShell sitzt (was jetzt der Fall ist), könnte man in Zukunft auf die throwing Variante zurückwechseln.
- **Resolver-Bugfix (Task 34):** `resolve-media-file.ts` unterscheidet nun `undefined` (Cache-Miss, Fetch läuft) von `null` (gecacht, keine Datei). `PlayerCore` wartet bei `undefined` statt sofort `markBrokenAndAdvance()` aufzurufen. `PlayerProvider` bumped `cacheVersion` nach jedem fetch → Effect in `PlayerCore` wird neu ausgelöst.

## Deferred / Out-of-scope

- **Plan 5 Follow-up F (cancel-job):** Wurde explizit aus Plan 4 ausgeschlossen — bleibt für später.
- **Manuelle Smoke-Tests (§12 Acceptance Criteria):** Nicht durchgeführt (kein laufender Browser verfügbar). Dev-Server muss manuell gestartet werden um die Akzeptanzkriterien 1–9 zu verifizieren.

## Potentielle Verbesserungen (Non-blocking)

- **`usePlayerStoreApiOptional` im `StandaloneList`:** Nutzt zwei separate `useSyncExternalStore`-Subscriptions für `currentVideoId` und `isPlaying`. Könnte auf `usePlayerStore`-Selektoren vereinfacht werden, sobald die Provider-Garantie stärker ist.
- **Button-Focus-Styles in `TrackRow`:** Der Play-Button erbt nur den Hover-Effekt vom Parent-Div. Explizite Fokus-Ring-Styles für bessere Keyboard-Accessibility wären ein gutes UI-Polish.
- **Mobile Layout Testing:** MobilePlayerSheet und BottomNav wurden auf Basis des Spec-Codes implementiert, aber noch nicht auf echten Mobilgeräten getestet. Mögliche Überlapp-Issues zwischen `bottom-14` Sheet und `BottomNav` sollten verifiziert werden.
- **MediaSession auf iOS Safari:** Die Web MediaSession API hat eingeschränkte Unterstützung auf iOS Safari — könnte ein Follow-up für geräteabhängige Anpassungen sein.
- **Persistenz mit `pagehide`:** Funktioniert in modernen Browsern gut, aber in manchen mobilen Browsern (iOS Safari Background-Tab) kann das Event unreliable sein. Alternativ könnte `visibilitychange` als Fallback dienen.
