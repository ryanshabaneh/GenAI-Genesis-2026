# 

 analyzes a GitHub repository and visualizes its production readiness as a 3D city. Each building represents a category (tests, CI/CD, Docker, logging, etc.) and grows taller as you improve it with help from specialized AI agents.

## What it does

- Paste a GitHub repo URL
- ShipCity clones and scans it across 14 production-readiness categories
- Your score is visualized as a 3D island village
- Click any building to chat with its AI agent, get real code suggestions, and accept changes
- Export all accepted changes as a ZIP

## Structure

```
/frontend   — Next.js 15 app (React Three Fiber, Zustand, Socket.IO client)
/server     — Express + Socket.IO backend (Claude API, analyzers, session store)
```

## Setup

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
