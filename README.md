# TubeVault

> Local archive for YouTube (and later SoundCloud) playlists with a built-in audio/video player. Proactively downloads tracks the moment they enter a watched playlist, so deletions, region-blocks, and channel takedowns can no longer eat your music collection.

## Status

Early development. See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/` for the implementation plans.

## Why

YouTube playlists rot. Channels delete videos, owners go private, regions block content. A curated playlist degrades silently over time. TubeVault watches a playlist, downloads each track once, and keeps it playable forever — even after the source disappears.

## Features (Phase 1)

- Add YouTube playlists or standalone videos via URL
- Download as audio (MP3 / Opus / M4A / FLAC) or video (configurable resolution and codec)
- Re-sync on demand or on a schedule; status badges show what's been deleted, gone private, or region-blocked
- Built-in audio + video player with queue, shuffle, repeat, fullscreen mode
- Per-playlist format overrides; global defaults in Settings
- Multi-provider-ready architecture (SoundCloud comes in Phase 2)

## Requirements

- Node.js 20+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on `$PATH`
- [ffmpeg](https://ffmpeg.org/) on `$PATH`

## Quick start

```bash
git clone https://github.com/<your-username>/tubevault.git
cd tubevault
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:3000>.

## Development

```bash
npm run dev          # Dev server
npm test             # Run tests
npm run lint         # Lint
npm run typecheck    # TypeScript check
npm run format       # Prettier write
```

## Architecture

See [`docs/superpowers/specs/2026-04-26-tubevault-design.md`](docs/superpowers/specs/2026-04-26-tubevault-design.md).

## License

MIT — see [LICENSE](LICENSE).

## Disclaimer

TubeVault is intended for **personal, private use only**. Downloading copyrighted material may violate the terms of service of source platforms and applicable copyright law in your jurisdiction. You are responsible for ensuring your use complies with local law and the rights of creators. The authors take no responsibility for misuse.
