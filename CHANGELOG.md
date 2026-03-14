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
- GitHub OAuth flow: session-based auth with token stored server-side, never exposed to frontend — `frontend`
- `GET /api/auth/github`, `/callback`, `/me`, `/logout` endpoints — `frontend`
- `express-session` middleware with httpOnly cookie — `frontend`
- `GitHubUser` type shared across server and frontend — `frontend`
- `useAuth` hook and `GitHubAuthButton` component — `frontend`
- `githubUser` state added to Zustand store — `frontend`
- `.env.local.example` for frontend environment setup — `frontend`

### Changed
- Updated `@anthropic-ai/sdk` to `^0.78.0` (previous version `^0.34.0` did not exist in registry) — `frontend`
- `server/.env.example` updated with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `BACKEND_URL` — `frontend`