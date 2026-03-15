# Shipyard

Shipyard analyzes a GitHub repository and visualizes its production readiness as an interactive 3D city. Each building represents a category of production-readiness, and grows taller as you improve it with help from specialized AI agents.

## What it does

1. Sign in with GitHub and pick one of your repos, or paste any public GitHub URL
2. Shipyard clones the repo and runs 8 deterministic analyzers — results stream live via WebSocket as buildings rise in real time
3. Click any building to open a chat with its specialist AI agent, which reads your actual source files for context
4. The agent generates code. Accept changes to queue them up
5. Export all accepted changes as a ZIP

## The 8 buildings

| Building | Category | What it checks |
|---|---|---|
| School | Tests | Test framework, test files, test script, coverage |
| Factory | CI/CD | GitHub Actions workflows, test/build/deploy steps |
| Shipping Dock | Docker | Dockerfile, .dockerignore, multi-stage builds, docker-compose |
| Town Hall | Documentation | README quality, description, setup instructions |
| Power Plant | Env Vars | .env.example, .gitignore rules, no hardcoded secrets |
| Vault | Security | Exposed keys, .gitignore coverage, secret pattern detection |
| Watchtower | Logging | Logging library, structured logs, no raw console.log |
| Launch Pad | Deployment | Deploy config, build/start scripts, platform recommendation |

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React Three Fiber, Zustand, Socket.IO, Tailwind, Framer Motion |
| Backend | Express, Socket.IO, TypeScript |
| AI | Claude Sonnet 4.6 via Anthropic API |
| Auth | GitHub OAuth 2.0 |

## Setup

### 1. Server

```bash
cd server
npm install
cp .env.example .env
# Fill in the values below
npm run dev
```

**server/.env**
```
ANTHROPIC_API_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Set `NEXT_PUBLIC_API_URL=http://localhost:3001` in `frontend/.env.local` if you need to override the default.
