# ShipCity

ShipCity analyzes a GitHub repository and visualizes its production readiness as a 3D village. Each building represents a category (tests, CI/CD, Docker, logging, etc.) and grows taller as you improve it with help from specialized AI agents.

## What it does

1. Paste a GitHub repo URL
2. ShipCity clones it and runs 8 deterministic analyzers (tests, CI/CD, Docker, documentation, env vars, security, logging, deployment)
3. Results stream live via WebSocket — buildings rise in real time as each analyzer finishes
4. Click any building to chat with its specialized AI agent, get real generated code, and accept changes
5. Export all accepted changes as a ZIP

## The 8 buildings

| Building | Category | What it checks |
|---|---|---|
| 🏫 School | Tests | Test framework, test files, test script, coverage ratio |
| 🏭 Factory | CI/CD | GitHub Actions workflows, test step, build/deploy step |
| 🚢 Shipping Dock | Docker | Dockerfile, .dockerignore, multi-stage build, docker-compose |
| 🏛️ Town Hall | Documentation | README exists, description, setup instructions, usage section |
| ⚡ Power Plant | Env Vars | .env.example, .env in .gitignore, no hardcoded secrets, process.env usage |
| 🏦 Vault | Security | No exposed keys, .gitignore coverage, secret pattern detection |
| 🗼 Watchtower | Logging | Logging library installed, imported, no raw console.log, structured logs |
| 🚀 Launch Pad | Deployment | Deploy config, build script, start script, configurable PORT |

## Structure

```
/frontend   — Next.js app (React Three Fiber, Zustand, Socket.IO client)
/server     — Express + Socket.IO backend (Claude API, analyzers, agents, session store)
```

## Setup

### 0. External dependencies (not in package.json)

The agent orchestrator uses [aider](https://aider.chat) via CLI for code generation. It requires Python 3.9+ and must be installed separately:

```bash
pip install aider-chat
```

Git must also be available on PATH (used by both the scanner and aider).

### 1. Server

```bash
cd server
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY in .env
# Fill in GITHUB_CLIENT_ID= GITHUB_CLIENT_SECRET= in .env

npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

**server/.env**
```
ANTHROPIC_API_KEY=your_key_here
PORT=3001
FRONTEND_URL=http://localhost:3000
TEMP_DIR=/tmp/shipcity-repos
```

**frontend** — set `NEXT_PUBLIC_API_URL=http://localhost:3001` if you need to override the default.
