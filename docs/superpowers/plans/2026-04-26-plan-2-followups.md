# Plan 2 — Follow-ups

## F1 — Polling endpoint shape

GET /api/playlists/[id] currently returns minimal `{ playlist, items: [], recentSyncRuns: [] }`. The full spec §8.3 shape (joined items with video + media_files + pendingJob) should be assembled when the UI needs it (Plan 5/6).

## F2 — POST /api/videos integration coverage

Service-level test (Task 23) covers the happy path; the route-level test only covers 4xx cases because exercising the real YouTubeAdapter via the route requires yt-dlp. Add an integration test using a registry stub when the test infra grows (Plan 5+).
