# Contributing to TubeVault

Thanks for considering a contribution! TubeVault is a small project; we keep things simple.

## Getting started

1. Fork and clone the repo.
2. Install Node 20+, yt-dlp, and ffmpeg.
3. `npm install`.
4. `npm run dev` to verify it boots.
5. `npm test` to verify tests pass.

## Development workflow

- Write tests first (TDD). Bug fixes start with a failing regression test.
- Keep PRs small and focused. One feature or fix per PR.
- All UI strings, code comments, and commit messages are in English.
- Run `npm run lint && npm run typecheck && npm test` before pushing.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add ...` — new feature
- `fix: ...` — bug fix
- `chore: ...` — tooling, deps, refactors with no behavior change
- `docs: ...` — documentation only
- `test: ...` — tests only

## Pull requests

- Reference the issue, if any
- Describe what changed and why
- Attach a screenshot for UI changes

## Code of conduct

Be kind. Discuss code, not people.
