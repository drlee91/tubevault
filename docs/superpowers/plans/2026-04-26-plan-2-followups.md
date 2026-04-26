# Plan 2 — Follow-ups

## F1 — Polling endpoint shape

GET /api/playlists/[id] currently returns minimal `{ playlist, items: [], recentSyncRuns: [] }`. The full spec §8.3 shape (joined items with video + media_files + pendingJob) should be assembled when the UI needs it (Plan 5/6).
