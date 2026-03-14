# 🏘️ ShipCity — Full Technical Plan

## Complete Structure, Workflow, and Tech Decisions

---

## THE EXPERIENCE END-TO-END

### Step 1: Landing Page
User arrives at shipcity.dev (or whatever domain).
Clean page. One input field. "Paste your GitHub URL."
They paste. Hit enter.

### Step 2: The Scan Begins — Village Builds Live
The screen transitions to a **blank 3D island** — just grass, dirt paths,
and empty foundation markers where buildings will go. An **NPC guide**
(a little character) walks to the center and says:

> 💬 "Welcome to ShipCity! I'm Scout. Let me take a look
> at your project and see what we're working with..."

The scan starts. It happens **progressively** — not all at once.
As each category finishes analyzing, its building plot updates in real time:

```
[Scanning CI/CD...]     → Factory foundation appears, stuck at 0%
[Scanning Tests...]     → School foundation appears, jumps to 25% (1 test file found)
[Scanning Docker...]    → Shipping Dock appears, 0% (nothing found)
[Scanning README...]    → Town Hall appears, 50% (README exists but incomplete)
[Scanning Security...]  → Vault appears, 0% (hardcoded secrets found)
...continues for all buildings...
```

The island goes from empty → partially built over ~20-30 seconds.
The user watches their village take shape in real time.
Each building materializes at whatever percentage the AI determines.

Scout (the NPC) reacts as results come in:

> 💬 "Ooh, you have a School started — some tests! But no Factory
> yet... we'll need CI/CD to keep this town running."

### Step 3: Explore the Village
User can navigate the 3D village. Click on any building.
Clicking opens that building's **detail panel** showing:
- Current completion percentage
- Task checklist (what's done, what's missing)
- A "Talk to Builder" button that opens the building's AI agent chat

### Step 4: Building Agents — The Multi-Agent Chat
Each building has its own **specialized AI agent** (the "Builder" NPC
for that building). When you open chat for the School (Tests):

> 🤖 **Test Builder:** "Your School is at 25%. Here's what we need
> to get to 100%:
>
> ☑️ Test framework installed (jest found)
> ☐ Unit tests for API routes (0 of 8 routes covered)
> ☐ Unit tests for utility functions (0 of 5 utils covered)
> ☐ Integration test for auth flow
> ☐ Test script in package.json
>
> Want me to start on any of these?"

User types: **"Implement task 1 — write unit tests for the API routes"**

The agent reads the actual route files, generates real tests,
and presents the code. User can:
- Preview the code
- Accept it (gets added to a "changes" queue)
- Ask for revisions ("make it use supertest instead")
- Reject it

When accepted, the building's percentage updates.
The 3D building visually grows to the next stage.

### Step 5: Export / Deploy
When the user has built up their village, they can:
- **Download all changes as a ZIP**
- **Generate a GitHub PR** with all accepted changes
- **View a summary** of everything that was added

---

## BUILDING REGISTRY — ALL 8 BUILDINGS

| # | Building | Category | What It Checks |
|---|---|---|---|
| 1 | 🏫 School | Tests and Error Handling | Try/Catch, error middleware, error boundaries, Test framework, test files, coverage, test scripts |
| 2 | 🏭 Factory | CI/CD | GitHub Actions, workflows, build pipeline |
| 3 | 🚢 Shipping Dock | Docker | Dockerfile, docker-compose, .dockerignore |
| 4 | ⚡ Power Plant | Env Variables | .env.example, no hardcoded configs, env validation |
| 5 | 🗼 Watchtower | Logging | Logging library, structured logs, no console.log |
| 6 | 🔒 Vault | Security | No secrets in code, dependency audit, HTTPS |
| 7 | 🚀 Launch Pad | Deployment, Hosting | Deploy config (Vercel/Railway/Fly.io), deploy scripts |
| 8 | 🏠 Server Room | Hosting | Server config, port binding, production mode, CORS |

### How Percentage Works Per Building

Each building has **4 tasks** (roughly). Each completed task = 25%.

Example — School (Tests):
```
0%   = No test framework, no tests
25%  = Test framework installed
50%  = Test framework + some test files exist
75%  = Good test coverage across main files
100% = Full coverage + test scripts + CI runs tests
```

Visual states of the 3D building:
```
0%   = Empty foundation / bare plot of land
25%  = Foundation + frame (scaffolding visible)
50%  = Half-built (walls up, no roof)
75%  = Almost done (roof on, some details missing)
100% = Complete building, lights on, smoke/activity
```

---

## THE NPC GUIDE — "SCOUT"

Scout is always present in the village. They serve as:

### Tutorial (First Visit)
When the village first loads, Scout walks the user through:

1. "Welcome! I scanned your project. Let me show you around."
2. Walks to the worst building → "See this empty lot? That means..."
3. "Click on it to see what's missing."
4. "Talk to the Builder inside to fix things."
5. "Let's try it — click on [worst building] now."
6. User clicks → Scout says "Great! Now ask the Builder to help."
7. After first fix: "See? The building grew! Keep going and
   watch your village come to life."

### Ongoing Help
- Click Scout at any time for tips
- Scout proactively comments when scan reveals something bad
  ("Uh oh, I see secrets in your code... the Vault is wide open!")
- Scout celebrates milestones ("50% production ready! The town
  is really coming together!")

### Scout is NOT an agent
Scout is scripted/templated — not a full LLM agent. This saves
API calls and keeps responses instant. Only the building agents
use LLM calls.

---

## PROGRESSIVE SCANNING — HOW IT WORKS

This is the key technical challenge. The scan must feel alive.

### Architecture: WebSocket-Based Streaming

```
Frontend                    Backend
   │                           │
   │  POST /scan {url}         │
   │ ─────────────────────►    │
   │                           │  Clone repo
   │                           │  ──────────
   │  WebSocket connection     │
   │ ◄═══════════════════════► │
   │                           │
   │  ws: {type: "scanning",   │  Analyze CI/CD...
   │       building: "factory"}│
   │ ◄════════════════════════ │
   │                           │
   │  ws: {type: "result",     │  CI/CD done!
   │       building: "factory",│
   │       percent: 0,         │
   │       tasks: [...]}       │
   │ ◄════════════════════════ │
   │                           │
   │  ws: {type: "scanning",   │  Analyze Tests...
   │       building: "school"} │
   │ ◄════════════════════════ │
   │                           │
   │  ws: {type: "result",     │  Tests done!
   │       building: "school", │
   │       percent: 25,        │
   │       tasks: [...]}       │
   │ ◄════════════════════════ │
   │                           │
   │  ... continues for all 14 │
   │                           │
   │  ws: {type: "complete",   │
   │       score: 34}          │
   │ ◄════════════════════════ │
```

### Scan Order (intentional — most dramatic first)

1. **Roads** (package scripts) — quick check, shows if project even runs
2. **Town Hall** (README) — everyone has one, sets the baseline
3. **Police Station** (linting) — quick file check
4. **Courthouse** (license) — instant check
5. **School** (tests) — important, usually partially there
6. **Power Plant** (env vars) — needs code scanning
7. **Vault** (security) — needs code scanning
8. **Hospital** (error handling) — needs AST analysis
9. **Watchtower** (logging) — needs code scanning
10. **Factory** (CI/CD) — checks .github/workflows
11. **Shipping Dock** (Docker) — checks for Dockerfile
12. **Pharmacy** (health checks) — needs route analysis
13. **Launch Pad** (deployment) — checks for deploy configs
14. **Server Room** (hosting) — checks server config

Fast checks first (buildings appear quickly, feels alive),
deep analysis later (user already engaged by then).

---

## MULTI-AGENT SYSTEM — ONE AGENT PER BUILDING

### Agent Architecture

Each building has a dedicated AI agent with:
- A **system prompt** specialized for that category
- **Context** about the user's specific codebase
- **Conversation memory** (within the session)
- **Tool access** — can read files from the cloned repo
- **Code generation** — can write and present code changes

### Agent Capabilities

Agents CAN:
- Read any file from the scanned repo
- Generate new files (test files, Dockerfiles, configs)
- Modify existing files (add error handling to routes)
- Explain why something matters
- Answer questions about that building's domain
- Present code diffs for approval

Agents CANNOT:
- Push code directly to GitHub (user must approve)
- Modify files outside their domain (Test agent can't edit Dockerfile)
- Talk to other agents (keeps scope clean)

### How Code Changes Work

```
User: "Write tests for my auth routes"
           │
           ▼
┌─────────────────────────────┐
│  School Agent (Test Builder) │
│                              │
│  1. Read src/routes/auth.ts  │
│  2. Understand the endpoints │
│  3. Generate test file       │
│  4. Present to user          │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Code Preview Panel          │
│                              │
│  Shows: tests/auth.test.ts   │
│  [Accept] [Revise] [Reject]  │
└─────────────────────────────┘
           │
      User clicks Accept
           │
           ▼
┌─────────────────────────────┐
│  Changes Queue               │
│                              │
│  + tests/auth.test.ts (new)  │
│  + package.json (modified)   │
│                              │
│  Building: School 25% → 50%  │
│  3D model updates live       │
└─────────────────────────────┘
```

### Agent System Prompts (simplified examples)

**School Agent (Tests):**
```
You are the Test Builder for ShipCity. You specialize in writing
tests for JavaScript/TypeScript projects. You have access to the
user's codebase. When asked to write tests, read the actual source
files and write real, working tests specific to their code.
Use the testing framework already in their project, or recommend
jest/vitest if none exists. Always explain what you're testing and why.
```

**Hospital Agent (Error Handling):**
```
You are the Error Handler for ShipCity. You specialize in adding
robust error handling to JavaScript/TypeScript projects. When asked
to add error handling, read their actual route handlers and middleware,
then generate proper try/catch blocks, error middleware, and error
response formatting specific to their code.
```

---

## TECH STACK — DECISION BY DECISION

### 3D Village Renderer
**Tech: React Three Fiber (R3F) + Three.js**

Why R3F:
- React-based — your frontend people already know React
- Declarative 3D — way easier than raw Three.js
- Good ecosystem — @react-three/drei has tons of helpers
- Runs in browser — no game engine needed

Why NOT Unity/Unreal:
- Overkill, can't embed in web app easily
- Team probably doesn't know C#/C++

Why NOT pure CSS/SVG isometric:
- You said 3D. R3F gives you real 3D with camera controls.
- Users can orbit, zoom, explore the village

**Building models:** Use low-poly 3D models.
- Source from Kenney.nl (free game assets, CC0 license)
- Or Quaternius (free low-poly models)
- Or Sketchfab (filter by free + CC license)
- glTF format — loads directly into R3F

**Building construction stages:** Use model opacity/scale/parts.
- 0%: Just a flat foundation pad
- 25%: Foundation + wireframe scaffolding
- 50%: Half the model visible, top half transparent
- 75%: Full model but muted colors, no lights
- 100%: Full model, glowing, particles/smoke

Alternatively: have 4-5 LOD versions of each model. Swap on percentage.

### Frontend Framework
**Tech: Next.js + TypeScript**

Why Next.js:
- React-based (R3F works perfectly)
- Easy deployment to Vercel (one click)
- API routes if needed (optional — can keep backend separate)
- Your team probably knows it

### State Management
**Tech: Zustand**

Why Zustand:
- Lightweight, minimal boilerplate
- Perfect for game-like state (buildings, percentages, chat histories)
- Works great with R3F (shared state between 3D scene and UI panels)

Store shape:
```
{
  repoUrl: string
  scanStatus: "idle" | "scanning" | "complete"
  score: number
  buildings: {
    [buildingId]: {
      status: "scanning" | "empty" | "partial" | "complete"
      percent: number
      tasks: Task[]
      chatHistory: Message[]
    }
  }
  activeBuilding: string | null
  changesQueue: CodeChange[]
  scout: { currentDialogue: string, position: [x,y,z] }
}
```

### Real-Time Updates
**Tech: Socket.IO**

Why Socket.IO:
- WebSocket with fallbacks
- Easy to set up on both ends
- Handles reconnection
- Your team has probably used it

Flow: Backend emits scan progress → Frontend receives → Zustand updates
→ R3F reactively re-renders buildings

### Backend
**Tech: Node.js + Express + TypeScript**

Why Express:
- Simple, everyone knows it
- Good enough for a hackathon
- Easy to add WebSocket alongside HTTP

### Repo Analysis
**Tech: simple-git + custom analyzers + Claude API**

Layer 1 — Deterministic checks (fast, no AI needed):
- File existence: Does Dockerfile exist? LICENSE? .eslintrc?
- Package.json parsing: What scripts exist? What deps?
- Pattern matching: Find .env files, find console.log statements
- Directory scanning: Is there a tests/ folder? __tests__? *.test.ts?

Layer 2 — AI-powered deep analysis (slower, runs second):
- Read actual code files and assess error handling quality
- Evaluate README completeness
- Detect hardcoded secrets that aren't obvious patterns
- Assess test quality (not just existence)

This two-layer approach means:
- Buildings start appearing FAST (deterministic checks in <2 seconds each)
- Then percentages refine as AI analysis completes
- Feels alive and responsive

### Multi-Agent Chat
**Tech: Claude API (claude-sonnet-4-20250514) with per-agent system prompts**

Each building agent is just a Claude conversation with:
- A specialized system prompt
- The relevant source files injected as context
- Tool use for file reading (if agent needs to look at more files)

NOT a framework like LangChain or CrewAI. Raw Claude API calls.
Simpler, faster, fewer dependencies, more control.

Why Sonnet not Opus:
- Faster responses (chat needs to feel snappy)
- Cheaper (you'll burn through API calls during demo)
- Good enough for code generation

### Code Display
**Tech: Monaco Editor (same editor as VS Code)**

Why Monaco:
- Syntax highlighting for free
- Diff view built in (show what's being added/changed)
- Users recognize it instantly
- @monaco-editor/react package for easy React integration

### Deployment
**Tech: Vercel (frontend) + Railway (backend)**

Why this split:
- Vercel is free, instant, perfect for Next.js
- Railway handles the backend + repo cloning + file system access
- Both deploy from GitHub push

---

## FULL PROJECT STRUCTURE

```
shipcity/
├── frontend/                    # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Landing page (URL input)
│   │   │   └── village/
│   │   │       └── page.tsx            # Main village experience
│   │   │
│   │   ├── components/
│   │   │   ├── scene/                  # 3D Village (React Three Fiber)
│   │   │   │   ├── Village.tsx         # Main 3D scene container
│   │   │   │   ├── Island.tsx          # Ground/terrain
│   │   │   │   ├── Building.tsx        # Individual building component
│   │   │   │   ├── BuildingSlot.tsx    # Empty lot / foundation
│   │   │   │   ├── Scout.tsx           # NPC guide character
│   │   │   │   ├── Camera.tsx          # Orbit controls + initial flyover
│   │   │   │   ├── Lights.tsx          # Scene lighting
│   │   │   │   └── Effects.tsx         # Particles, glow, atmosphere
│   │   │   │
│   │   │   ├── ui/                     # 2D UI overlaid on 3D
│   │   │   │   ├── ScoreBar.tsx        # Production readiness score
│   │   │   │   ├── StageLabel.tsx      # "Prototype → Production" indicator
│   │   │   │   ├── BuildingPanel.tsx   # Side panel when building clicked
│   │   │   │   ├── TaskChecklist.tsx   # Tasks within a building
│   │   │   │   ├── ChatWindow.tsx      # Agent chat interface
│   │   │   │   ├── CodePreview.tsx     # Monaco editor for generated code
│   │   │   │   ├── ChangesQueue.tsx    # List of accepted changes
│   │   │   │   ├── DialogueBubble.tsx  # Scout speech bubble
│   │   │   │   ├── ScanProgress.tsx    # Loading overlay during scan
│   │   │   │   ├── TutorialOverlay.tsx # Scout walkthrough steps
│   │   │   │   └── ExportPanel.tsx     # Download ZIP / Create PR
│   │   │   │
│   │   │   └── landing/
│   │   │       └── URLInput.tsx        # GitHub URL input + submit
│   │   │
│   │   ├── store/
│   │   │   └── useStore.ts            # Zustand store (all village state)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSocket.ts           # Socket.IO connection + listeners
│   │   │   ├── useScan.ts            # Trigger scan, handle progress
│   │   │   └── useAgent.ts           # Send messages to building agents
│   │   │
│   │   ├── lib/
│   │   │   ├── buildings.ts           # Building registry (names, positions, models)
│   │   │   ├── stages.ts             # Percentage → visual state mapping
│   │   │   ├── tutorial.ts           # Scout dialogue scripts
│   │   │   └── api.ts                # HTTP + WebSocket client helpers
│   │   │
│   │   └── types/
│   │       └── index.ts               # Shared TypeScript types
│   │
│   ├── public/
│   │   └── models/                    # 3D model files (.glb)
│   │       ├── island.glb
│   │       ├── school_0.glb           # 0% state
│   │       ├── school_25.glb          # 25% state
│   │       ├── school_50.glb
│   │       ├── school_75.glb
│   │       ├── school_100.glb
│   │       ├── factory_0.glb
│   │       ├── ... (all buildings × 5 states)
│   │       ├── scout.glb              # NPC character model
│   │       └── props/                 # Trees, fences, decorations
│   │
│   └── package.json
│
├── server/                     # Express backend
│   ├── src/
│   │   ├── index.ts                   # Express + Socket.IO server setup
│   │   │
│   │   ├── routes/
│   │   │   ├── scan.ts                # POST /scan — start analysis
│   │   │   ├── chat.ts                # POST /chat — agent message
│   │   │   └── export.ts              # POST /export — generate ZIP/PR
│   │   │
│   │   ├── scanner/                   # Repo analysis engine
│   │   │   ├── index.ts               # Orchestrator — runs all analyzers
│   │   │   ├── clone.ts               # Clone repo from GitHub URL
│   │   │   ├── analyzers/
│   │   │   │   ├── base.ts            # Base analyzer interface
│   │   │   │   ├── tests.ts           # School — test detection
│   │   │   │   ├── cicd.ts            # Factory — CI/CD detection
│   │   │   │   ├── docker.ts          # Shipping Dock — Docker detection
│   │   │   │   ├── readme.ts          # Town Hall — docs quality
│   │   │   │   ├── errorHandling.ts   # Hospital — error handling
│   │   │   │   ├── envVars.ts         # Power Plant — env management
│   │   │   │   ├── logging.ts         # Watchtower — logging
│   │   │   │   ├── linting.ts         # Police Station — linting config
│   │   │   │   ├── license.ts         # Courthouse — license
│   │   │   │   ├── security.ts        # Vault — secrets detection
│   │   │   │   ├── healthCheck.ts     # Pharmacy — health endpoints
│   │   │   │   ├── scripts.ts         # Roads — package scripts
│   │   │   │   ├── deployment.ts      # Launch Pad — deploy config
│   │   │   │   └── hosting.ts         # Server Room — server config
│   │   │   │
│   │   │   └── scoring.ts            # Percentage + task calculation
│   │   │
│   │   ├── agents/                    # Multi-agent system
│   │   │   ├── index.ts               # Agent router (building → agent)
│   │   │   ├── base.ts               # Base agent class
│   │   │   ├── prompts/
│   │   │   │   ├── tests.ts           # School agent system prompt
│   │   │   │   ├── cicd.ts            # Factory agent system prompt
│   │   │   │   ├── docker.ts
│   │   │   │   ├── readme.ts
│   │   │   │   ├── errorHandling.ts
│   │   │   │   ├── envVars.ts
│   │   │   │   ├── logging.ts
│   │   │   │   ├── linting.ts
│   │   │   │   ├── license.ts
│   │   │   │   ├── security.ts
│   │   │   │   ├── healthCheck.ts
│   │   │   │   ├── scripts.ts
│   │   │   │   ├── deployment.ts
│   │   │   │   └── hosting.ts
│   │   │   │
│   │   │   └── context.ts            # Reads relevant files for agent context
│   │   │
│   │   ├── changes/                   # Code change management
│   │   │   ├── queue.ts               # Track accepted changes
│   │   │   ├── apply.ts              # Apply changes to cloned repo
│   │   │   └── export.ts             # ZIP generation / GitHub PR creation
│   │   │
│   │   └── types/
│   │       └── index.ts
│   │
│   └── package.json
│
└── README.md
```

---

## DATA FLOW — COMPLETE LIFECYCLE

```
┌──────────────────────────────────────────────────────────┐
│ 1. USER PASTES URL                                        │
│    shipcity.dev → types github.com/user/repo → hits enter │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 2. BACKEND RECEIVES URL                                   │
│    POST /scan { url: "github.com/user/repo" }             │
│    → Validates URL                                        │
│    → Clones repo to temp directory                        │
│    → Opens WebSocket channel to frontend                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. PROGRESSIVE SCAN (runs analyzers one by one)           │
│                                                           │
│    For each of 14 analyzers:                              │
│      a) Emit ws: { status: "scanning", building: "X" }   │
│         → Frontend shows scanning indicator on that plot  │
│                                                           │
│      b) Run deterministic checks (file exists? patterns?) │
│                                                           │
│      c) Run AI analysis if needed (code quality check)    │
│                                                           │
│      d) Calculate percentage + generate task list          │
│                                                           │
│      e) Emit ws: { status: "result", building: "X",      │
│                     percent: 25, tasks: [...] }           │
│         → Frontend builds/updates that building in 3D     │
│         → Scout NPC reacts                                │
│                                                           │
│    After all 14:                                          │
│      Emit ws: { status: "complete", score: 34 }           │
│      → Scout starts tutorial walkthrough                  │
└──────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 4. USER EXPLORES VILLAGE                                  │
│    → Orbits camera, clicks buildings                      │
│    → Scout guides them to worst building first            │
│    → Building panel opens with tasks + chat               │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 5. USER CHATS WITH BUILDING AGENT                         │
│                                                           │
│    User: "Write tests for my auth routes"                 │
│                                                           │
│    POST /chat {                                           │
│      building: "tests",                                   │
│      message: "Write tests for my auth routes",           │
│      history: [...previous messages...]                   │
│    }                                                      │
│                                                           │
│    Backend:                                               │
│      → Loads agent system prompt for "tests"              │
│      → Reads relevant source files from cloned repo       │
│      → Sends to Claude with context                       │
│      → Returns response with generated code               │
│                                                           │
│    Frontend:                                              │
│      → Shows response in chat                             │
│      → Shows code in Monaco editor preview                │
│      → [Accept] [Revise] [Reject] buttons                 │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 6. USER ACCEPTS CODE → BUILDING GROWS                     │
│                                                           │
│    POST /accept {                                         │
│      building: "tests",                                   │
│      files: [{ path: "tests/auth.test.ts", content: ...}]│
│    }                                                      │
│                                                           │
│    Backend:                                               │
│      → Adds to changes queue                              │
│      → Recalculates building percentage                   │
│      → Marks task as complete                             │
│                                                           │
│    Frontend:                                              │
│      → Building 3D model transitions to next stage        │
│         (e.g., 25% → 50%, scaffolding → half-built)      │
│      → Task gets checked off                              │
│      → Score updates                                      │
│      → Scout celebrates if milestone hit                  │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 7. EXPORT WHEN READY                                      │
│                                                           │
│    User clicks "Export" or "Create PR"                    │
│                                                           │
│    POST /export {                                         │
│      format: "zip" | "github-pr",                         │
│      changes: [...all accepted changes...]                │
│    }                                                      │
│                                                           │
│    → Generates ZIP download                               │
│    → OR creates GitHub PR with all changes                │
└──────────────────────────────────────────────────────────┘
```

---

## TEAM ASSIGNMENTS (5 people)

### 🎮 Person 1: 3D Village (React Three Fiber)
**The most visible work. Makes or breaks the demo.**

Owns:
- Village.tsx — main R3F scene with island, camera, lights
- Building.tsx — loads correct 3D model based on percentage
- BuildingSlot.tsx — empty lot with foundation marker
- Scout.tsx — NPC character (can be a simple animated model)
- Camera flyover animation on first load
- Click detection on buildings (raycasting)
- Building transition animations (grow/fade between stages)
- Particle effects (sparkles when building completes)
- Overall atmosphere (lighting, sky, ambient effects)

Key decisions:
- Use @react-three/drei for OrbitControls, useGLTF, Html overlays
- Use @react-three/postprocessing for bloom/glow on complete buildings
- Kenney.nl or Quaternius for free low-poly building models
- If custom models needed, use Blockbench (free, fast voxel modeler)

Does NOT own: Any UI panels, chat, or backend logic.

### 🔍 Person 2: Scanner Engine (Backend)
**The brain that reads repos and scores them.**

Owns:
- clone.ts — clone repo from GitHub URL to temp dir
- All 14 analyzer files (tests.ts, cicd.ts, docker.ts, etc.)
- scoring.ts — calculate percentage per building
- Task generation — what specific tasks are needed per building
- Socket.IO emission — progressive results to frontend
- Scan orchestration — run analyzers in sequence, emit as each completes

Key decisions:
- Layer 1 (deterministic) runs first — file checks, regex, package.json parsing
- Layer 2 (AI) runs second for nuanced checks — read code, assess quality
- Each analyzer returns: { percent, tasks[], details }
- Use simple-git for cloning
- Cache cloned repos by URL hash (don't re-clone on refresh)

Does NOT own: Agent chat, code generation, or frontend.

### 🤖 Person 3: Multi-Agent System (AI)
**The builders inside each building.**

Owns:
- All 14 agent system prompts
- context.ts — reads the RIGHT files from repo to give agent context
  (e.g., test agent gets route files, Docker agent gets package.json)
- Base agent class — manages conversation, sends to Claude, parses response
- Code extraction from Claude responses (pull out the generated files)
- POST /chat endpoint
- Handling "Accept" — update tasks, recalculate percentage

Key decisions:
- Each agent = one Claude conversation with specialized system prompt
- Context injection: read 3-5 most relevant files per building type
- Agents output structured responses: explanation + code blocks
- Parse code blocks from response → display in Monaco
- Keep conversation history per building per session (in memory)
- Sonnet for speed and cost

Does NOT own: Scanner, 3D rendering, or UI.

### 💻 Person 4: Frontend UI + Integration
**Everything the user interacts with that isn't 3D.**

Owns:
- Landing page with URL input
- Zustand store setup
- useSocket.ts — connect to backend, update store on messages
- BuildingPanel.tsx — side panel when building clicked
- TaskChecklist.tsx — checkboxes per building
- ChatWindow.tsx — chat interface for agents
- CodePreview.tsx — Monaco editor showing generated code
- Accept/Revise/Reject buttons + logic
- ChangesQueue.tsx — list of all accepted changes
- ExportPanel.tsx — download ZIP button
- ScoreBar.tsx — overall production readiness
- ScanProgress.tsx — loading overlay during scan
- DialogueBubble.tsx — Scout's speech bubbles
- TutorialOverlay.tsx — step-by-step Scout walkthrough

Key decisions:
- UI panels overlay on the right side, village takes left 60%
- Chat uses a simple message list + input, not a full chat library
- Monaco Editor via @monaco-editor/react, read-only with copy button
- Responsive: works on laptop screens (1280px minimum)
- Socket.IO client for real-time scan updates

Does NOT own: 3D scene, backend logic, or agent prompts.

### 📢 Person 5: Demo, Content, Deploy, Polish
**Makes sure everything is shippable.**

Owns:
- Find/prepare 2-3 demo repos at different quality levels
- Deploy frontend to Vercel
- Deploy backend to Railway
- Domain setup (shipcity.dev or similar)
- README with screenshots and setup instructions
- Demo script + rehearsal
- Backup video recording
- Submission text
- Scout dialogue scripts (tutorial + reactions)
- Help Person 1 source 3D models
- Help Person 2 test analyzers against real repos
- Bug testing everything end-to-end

Does NOT own: Core code. Owns everything around the code.

---

## CRITICAL MILESTONES

### Hour 3 Checkpoint
- [ ] Person 1: R3F scene renders with an island and placeholder cubes
- [ ] Person 2: Can clone a repo and run 3 analyzers
- [ ] Person 3: One agent chat working end-to-end
- [ ] Person 4: Landing page → sends URL → receives mock data → renders UI
- [ ] Person 5: Demo repos identified, 3D model assets sourced

### Hour 8 Checkpoint
- [ ] Person 1: Buildings load based on percentage, click detection works
- [ ] Person 2: All 14 analyzers running, WebSocket streaming results
- [ ] Person 3: 5+ agents producing good code
- [ ] Person 4: Full UI panels working with mock data
- [ ] Person 5: Frontend deployed to Vercel, backend to Railway

### Hour 14 Checkpoint — FULL INTEGRATION
- [ ] Paste URL → scan runs → village builds progressively → click building → chat → accept → building grows
- [ ] This is the make-or-break moment. If this flow works, you win.

### Hour 18 Checkpoint — POLISH
- [ ] Animations smooth
- [ ] Scout tutorial works
- [ ] 3 demo repos tested and cached
- [ ] No crashes on bad input
- [ ] Loading states everywhere

### Hour 22 — DEMO PREP
- [ ] Demo rehearsed 3x
- [ ] Backup video recorded
- [ ] Submission written
- [ ] Team knows the talking points

---

## 3D MODEL STRATEGY

You need ~14 buildings × 5 states = 70 model variations.
That's impossible to make from scratch. Here's the plan:

### Option A: Smart Model Reuse (Recommended)
1. Get 14 unique low-poly building models from Kenney.nl (free, CC0)
2. For construction stages, DON'T make separate models:
   - 0% = flat foundation pad (one shared model)
   - 25% = building model at 30% opacity + scaffolding prop
   - 50% = building model, bottom half solid, top half transparent
   - 75% = full model but desaturated/dark
   - 100% = full model with glow, particles, lights
3. This means you need: 14 building models + 1 foundation + 1 scaffolding = 16 models total
4. Construction stages handled by shader/material/opacity changes in code

### Option B: Voxel Models (If you have a fast artist)
- Use MagicaVoxel (free) to quickly make voxel buildings
- Voxel style = fast to create + looks charming
- Export as .glb for R3F
- Still use opacity/shader tricks for construction stages

### Option C: Primitive Geometry (Fastest, least pretty)
- Buildings are just colored boxes/cylinders with emoji textures
- Foundation = flat grey box
- Construction = box growing in Y scale
- Complete = box with glow
- Looks minimal but works. Ship it.

**Recommendation:** Start with Option C to get the flow working by Hour 8.
Upgrade to Option A or B during the polish phase (Hours 14-18).
Don't let 3D art block your core functionality.

---

## THE DEMO SCRIPT (2 minutes)

**[0:00-0:15] Setup**
> "Every developer has a side project. Every side project is missing
> the same things. We built a game that fixes that."
> *Paste a GitHub URL into ShipCity*

**[0:15-0:35] The Scan**
> *Island appears. Scout walks out.*
> *"Surveying the land..."*
> *Buildings start appearing one by one — some are half-built,
> most are empty lots*
> "34% production ready. It's a ghost town."

**[0:35-0:55] Scout Tutorial**
> *Scout walks to the empty Hospital*
> *"This town has no Hospital! Your API routes have zero
> error handling."*
> "Let's fix it."
> *Click on Hospital*

**[0:55-1:25] Agent Interaction**
> *Chat opens. Type: "Add error handling to my routes"*
> *Agent reads the actual code, generates real error middleware*
> *Code appears in Monaco editor*
> *Click Accept*
> *Hospital rises from foundation to 25% — scaffolding appears*
> "The agent just read their actual Express routes and wrote
> real error handling. Not a template. Real code."

**[1:25-1:45] Speed Round**
> *Quick: ask School agent for tests → Accept → School builds*
> *Quick: ask Factory agent for CI/CD → Accept → Factory builds*
> *Village is visibly coming alive*
> "Three clicks. Ghost town to functioning town."

**[1:45-2:00] Close**
> *Show score going from 34% to 58%*
> "Bitdeer asked us to bridge the gap between side projects and
> production. ShipCity doesn't just bridge it — it gamifies it.
> Your codebase is a village. How alive is yours?"

---

## RISK TABLE

| Risk | Likelihood | Mitigation |
|---|---|---|
| 3D rendering takes too long to build | HIGH | Start with colored boxes. Upgrade art later. Never block on art. |
| Agent generates bad code during demo | MEDIUM | Pre-test demo repos. Cache agent responses for demo. Have backup video. |
| Repo cloning is slow on stage | HIGH | Pre-clone and cache demo repos. Scan results stored in DB/memory. |
| 14 analyzers is too many | MEDIUM | Prioritize 8 most impactful. Mark others as "coming soon." |
| WebSocket connection drops | LOW | Fallback: poll endpoint every 2 seconds instead. |
| Team runs out of time on polish | HIGH | Hour 14 is the cut — if core flow doesn't work by then, cut features. |
| 3D models look terrible | MEDIUM | Low-poly/voxel style is forgiving. Lighting and glow hide a lot of sins. |

---

## SCOPE CUTS — IF RUNNING BEHIND

Cut in this order (last resort first):

1. **Cut: Export as GitHub PR** → just do ZIP download
2. **Cut: Scout tutorial** → just let users click around
3. **Cut: Building animations** → buildings just appear at final state
4. **Cut: 14 buildings → 8 buildings** → drop the less critical ones
5. **Cut: AI-powered analysis** → all deterministic checks only
6. **NEVER CUT: Agent chat + code generation** → this is the product
7. **NEVER CUT: Progressive scan** → this is the wow moment
8. **NEVER CUT: 3D village** → this is what judges remember
