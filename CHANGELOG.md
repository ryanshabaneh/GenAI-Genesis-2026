# Changelog

All notable changes to this project are tracked here.

## Contributing to the Changelog

**Every branch and merged PR must include a changelog update before merging into `main`.**

### Rules

- When you create a branch, add an entry under `[Unreleased]` describing the planned change.
- Before merging into `main`, update or confirm that entry reflects what was actually built.
- Entries belong under the appropriate section: `Added`, `Changed`, `Fixed`, `Removed`, or `Security`.
- Use plain language — describe the user-facing or system-level impact, not the implementation details.
- Include the source branch as attribution on each entry using `— \`branch-name\``.
- Date format: `YYYY-MM-DD`

### Format

```
## [Unreleased]

### Added
- Short description of what was added — `branch-name`

### Changed
- Short description of what was changed — `branch-name`

### Fixed
- Short description of what was fixed — `branch-name`
```

When a version is released, rename `[Unreleased]` to the version number and date (e.g., `## [1.0.0] - 2026-03-14`) and open a new `[Unreleased]` section above it.

---

## [Unreleased]

### Added
- Initial project scaffold: frontend (Next.js) and server directories — `main`
- CHANGELOG with contribution requirements for branch and merge tracking — `main`
- Per-entry branch attribution format added to CHANGELOG — `main`
- Express + Socket.IO server with CORS, JSON parsing, and global error handling — `infra-branch`
- `POST /api/scan` endpoint: accepts a GitHub URL, creates a session, returns sessionId immediately, runs clone + scan in background — `infra-branch`
- `POST /api/chat` endpoint: routes messages to the specialist AI agent for a given building — `infra-branch`
- `POST /api/accept` endpoint: records accepted code changes, bumps building percent by 25 (capped at 100), marks next task done, returns updated score — `infra-branch`
- `POST /api/export` endpoint: packages all accepted changes for a session into a downloadable ZIP — `infra-branch`
- In-memory session store with create, get, update, and delete operations — `infra-branch`
- Change queue per session with `addChange` and `getChanges` helpers — `infra-branch`
- ZIP generation via `archiver` for the export endpoint — `infra-branch`
- Shared TypeScript types for `Session`, `AnalyzerResult`, `AcceptedChange`, `Message`, and `WsEvent` — `infra-branch`
- Socket.IO room-based session joining so scan events stream only to the correct client — `infra-branch`
- `GET /health` endpoint for hosting platform uptime checks — `infra-branch`

### Changed
- Updated `@anthropic-ai/sdk` from `^0.34.0` to `^0.78.0` to match latest available version — `infra-branch`
