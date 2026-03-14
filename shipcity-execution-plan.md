# ShipCity — Execution Plan

## 4 People. 24 Hours. 8 Buildings. One Demo.

---

## THE ONLY THING THAT MATTERS

This flow must work by hour 14 or you lose:

```
Paste URL → Scan → Village builds live → Click building → Chat → Accept code → Building grows
```

Everything else is polish.

---

## TEAM ROSTER

| Role | Person | One-line job |
|---|---|---|
| 🔍 Backend 1 | Scanner | Clone repos, analyze code, score buildings, stream results |
| 🤖 Backend 2 | AI Agents | Claude prompts, code generation, chat endpoint |
| ⚙️ Backend 3 | Infra Glue | Express server, Socket.IO, state, export, connects everything |
| 🎮 Frontend | Village + UI | 3D scene, building rendering, chat panel, real-time updates |

---

## 🔍 BACKEND 1 — SCANNER

### What you own
You are the eyes. You clone a repo, rip it apart, and tell the frontend
what percentage each building should be at.

### Files you create

```
server/src/scanner/
├── clone.ts              # Clone GitHub repo to temp dir
├── index.ts              # Orchestrator — runs analyzers in sequence, emits results
├── analyzers/
│   ├── tests.ts          # School — look for test framework, test files, test scripts
│   ├── cicd.ts           # Factory — look for .github/workflows/, CI config
│   ├── docker.ts         # Shipping Dock — Dockerfile, docker-compose, .dockerignore
│   ├── docs.ts           # Town Hall — README quality, setup instructions
│   ├── envVars.ts        # Power Plant — .env.example, hardcoded secrets check
│   ├── security.ts       # Vault — secrets in code, dependency audit patterns
│   ├── logging.ts        # Watchtower — logging library, console.log count
│   └── deployment.ts     # Launch Pad — deploy config (vercel.json, fly.toml, etc.)
└── scoring.ts            # Takes analyzer output → percentage + task list
```

### What each analyzer does

Every analyzer exports the same shape:

```typescript
interface AnalyzerResult {
  building: string
  percent: 0 | 25 | 50 | 75 | 100
  tasks: { id: string; label: string; done: boolean }[]
  details: string  // one-line summary for Scout NPC
}
```

**tests.ts — School**
```
Check for:
- package.json has jest/vitest/mocha in devDeps     → +25%
- test files exist (*.test.ts, *.spec.ts, __tests__) → +25%
- package.json has "test" script                     → +25%
- test files cover >50% of src files                 → +25%

Tasks generated:
☐ "Install a test framework (jest or vitest)"
☐ "Add test files for your source code"
☐ "Add a test script to package.json"
☐ "Increase test coverage to 50%+"
```

**cicd.ts — Factory**
```
Check for:
- .github/workflows/ directory exists                → +25%
- At least one .yml workflow file                    → +25%
- Workflow includes a test step                      → +25%
- Workflow includes a build or deploy step            → +25%
```

**docker.ts — Shipping Dock**
```
Check for:
- Dockerfile exists                                  → +25%
- .dockerignore exists                               → +25%
- Dockerfile uses multi-stage build or COPY properly → +25%
- docker-compose.yml exists                          → +25%
```

**docs.ts — Town Hall**
```
Check for:
- README.md exists                                   → +25%
- README has >200 characters (not just title)         → +25%
- README contains "install" or "setup" section        → +25%
- README contains "usage" or "run" section            → +25%
```

**envVars.ts — Power Plant**
```
Check for:
- .env is in .gitignore                              → +25%
- .env.example or .env.template exists               → +25%
- No hardcoded strings matching API key patterns      → +25%
- Code uses process.env (not inline strings)          → +25%
```

**security.ts — Vault**
```
Check for:
- No AWS/Stripe/GitHub keys in source files           → +25%
- .gitignore covers sensitive files                   → +25%
- Dependencies don't have known major vulns (check package-lock) → +25%
- No passwords or tokens in config files              → +25%
```

**logging.ts — Watchtower**
```
Check for:
- A logging library installed (winston, pino, etc.)   → +25%
- Logging library actually imported somewhere          → +25%
- console.log count < 10                              → +25%
- Structured logging format (JSON logs)               → +25%
```

**deployment.ts — Launch Pad**
```
Check for:
- Deploy config file exists (vercel.json, fly.toml, railway.json, Procfile) → +25%
- package.json has "build" script                     → +25%
- package.json has "start" script with NODE_ENV       → +25%
- Port is configurable (process.env.PORT)             → +25%
```

### How you stream results

You don't return everything at once. You emit via Socket.IO as each
analyzer finishes:

```typescript
// In index.ts orchestrator
async function scanRepo(repoPath: string, socket: Socket) {
  const analyzers = [
    { name: 'docs', fn: analyzeDocs },      // fast ones first
    { name: 'security', fn: analyzeSecurity },
    { name: 'envVars', fn: analyzeEnvVars },
    { name: 'tests', fn: analyzeTests },
    { name: 'cicd', fn: analyzeCICD },
    { name: 'docker', fn: analyzeDocker },
    { name: 'logging', fn: analyzeLogging },
    { name: 'deployment', fn: analyzeDeployment },
  ]

  for (const analyzer of analyzers) {
    socket.emit('scan:scanning', { building: analyzer.name })
    const result = await analyzer.fn(repoPath)
    socket.emit('scan:result', result)
  }

  socket.emit('scan:complete', { score: calculateOverallScore() })
}
```

### Your timeline

| Hour | Task | Delivers |
|---|---|---|
| 0-1 | Set up clone.ts — accept URL, clone to /tmp | Can clone any public repo |
| 1-3 | Build first 3 analyzers: docs, tests, security | 3 buildings get scores |
| 3-5 | Build remaining 5 analyzers | All 8 buildings scored |
| 5-7 | Integrate with Backend 3's Socket.IO | Results stream to frontend live |
| 7-10 | Test against 3 real repos, fix edge cases | Scores are accurate and believable |
| 10-14 | Refine scoring, handle weird repos, add detail | Rock-solid scanning |
| 14-18 | Help Backend 2 with file reading for agents | Agents can read the right files |
| 18-24 | Cache demo repos, optimize speed, bug fixes | Demo is fast and reliable |

### Mock data (for Frontend to use before you're ready)

Give this to Frontend on hour 0:

```json
{
  "buildings": [
    { "building": "tests", "percent": 25, "tasks": [
      { "id": "t1", "label": "Install test framework", "done": true },
      { "id": "t2", "label": "Add test files for routes", "done": false },
      { "id": "t3", "label": "Add test script to package.json", "done": false },
      { "id": "t4", "label": "Reach 50% test coverage", "done": false }
    ]},
    { "building": "cicd", "percent": 0, "tasks": [
      { "id": "c1", "label": "Create .github/workflows directory", "done": false },
      { "id": "c2", "label": "Add CI workflow file", "done": false },
      { "id": "c3", "label": "Add test step to workflow", "done": false },
      { "id": "c4", "label": "Add deploy step to workflow", "done": false }
    ]},
    { "building": "docker", "percent": 0, "tasks": [] },
    { "building": "docs", "percent": 50, "tasks": [] },
    { "building": "envVars", "percent": 0, "tasks": [] },
    { "building": "security", "percent": 25, "tasks": [] },
    { "building": "logging", "percent": 0, "tasks": [] },
    { "building": "deployment", "percent": 0, "tasks": [] }
  ]
}
```

---

## 🤖 BACKEND 2 — AI AGENTS

### What you own
You are the brain. When someone clicks a building and types "fix this,"
you read the actual code, talk to Claude, and generate real working code.

### Files you create

```
server/src/agents/
├── index.ts              # Agent router — picks the right agent for a building
├── base.ts               # Shared logic: call Claude, parse response, extract code
├── context.ts            # Read the RIGHT files from repo for each building type
├── prompts/
│   ├── tests.ts          # System prompt for School agent
│   ├── cicd.ts           # System prompt for Factory agent
│   ├── docker.ts         # System prompt for Shipping Dock agent
│   ├── docs.ts           # System prompt for Town Hall agent
│   ├── envVars.ts        # System prompt for Power Plant agent
│   ├── security.ts       # System prompt for Vault agent
│   ├── logging.ts        # System prompt for Watchtower agent
│   └── deployment.ts     # System prompt for Launch Pad agent
└── parser.ts             # Extract code blocks from Claude response
```

### How an agent call works

```typescript
// POST /chat
// Body: { building: "tests", message: "write tests for auth", history: [...] }

async function handleChat(building: string, message: string, history: Message[], repoPath: string) {

  // 1. Get the right system prompt
  const systemPrompt = getPrompt(building)

  // 2. Get relevant files from the repo
  const files = await getContext(building, repoPath)
  // For "tests" agent: reads src/routes/*.ts, src/utils/*.ts, package.json
  // For "docker" agent: reads package.json, tsconfig.json, src/index.ts
  // For "cicd" agent: reads package.json, existing workflows if any

  // 3. Build the Claude message
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Here are the relevant files from the project:\n\n${formatFiles(files)}` },
      ...history,
      { role: "user", content: message }
    ]
  })

  // 4. Parse response — extract explanation + code blocks
  const parsed = parseResponse(response.content[0].text)
  // { explanation: "Here's what I did...", files: [{ path: "tests/auth.test.ts", content: "..." }] }

  return parsed
}
```

### context.ts — What files each agent reads

This is critical. Each agent needs different files to generate good code.

```typescript
const CONTEXT_MAP: Record<string, string[]> = {
  tests: ['src/**/*.ts', 'src/**/*.js', 'package.json', 'tsconfig.json'],
  cicd: ['package.json', '.github/workflows/*.yml', 'Makefile'],
  docker: ['package.json', 'tsconfig.json', 'src/index.ts', 'src/main.ts'],
  docs: ['package.json', 'src/index.ts', 'README.md'],
  envVars: ['src/**/*.ts', '.env', '.env.example', '.gitignore'],
  security: ['package.json', 'package-lock.json', 'src/**/*.ts'],
  logging: ['src/**/*.ts', 'package.json'],
  deployment: ['package.json', 'Dockerfile', 'vercel.json', 'fly.toml'],
}
```

Don't read ALL files — Claude has a context limit and it'll be slow.
Read the 5-10 most relevant files. Truncate large files to first 200 lines.

### System prompt example (tests agent)

```typescript
export const TESTS_PROMPT = `You are the Test Builder for ShipCity.

Your job is to write real, working tests for the user's project.

Rules:
- Read the source files provided and write tests for the actual functions and routes
- Use the test framework already in their project. If none exists, use vitest.
- Always include the import statements
- Always include setup/teardown if needed
- Write tests that actually assert meaningful behavior, not just "it exists"
- When outputting code, wrap it in a code block with the filepath as the language tag:

\`\`\`tests/auth.test.ts
import { describe, it, expect } from 'vitest'
// ... test code
\`\`\`

Keep your explanation brief. Focus on the code.`
```

### parser.ts — Extract code from Claude's response

```typescript
interface ParsedResponse {
  explanation: string
  files: { path: string; content: string }[]
}

function parseResponse(text: string): ParsedResponse {
  const files: { path: string; content: string }[] = []

  // Find all code blocks with filepath labels
  const codeBlockRegex = /```(\S+)\n([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(text)) !== null) {
    files.push({ path: match[1], content: match[2].trim() })
  }

  // Everything outside code blocks is explanation
  const explanation = text.replace(codeBlockRegex, '').trim()

  return { explanation, files }
}
```

### How "Accept" works

When user clicks Accept on generated code:

```typescript
// POST /accept
// Body: { building: "tests", files: [{ path, content }] }

async function handleAccept(building: string, files: FileChange[], sessionId: string) {
  // 1. Add to changes queue
  changesQueue[sessionId].push(...files)

  // 2. Recalculate building percentage
  // Mark the relevant task as done
  // Bump percentage by 25
  const newPercent = Math.min(currentPercent + 25, 100)

  // 3. Return updated building state
  return { building, percent: newPercent }
}
```

Frontend receives this → 3D building transitions to next stage.

### Your timeline

| Hour | Task | Delivers |
|---|---|---|
| 0-1 | Set up Claude API client, test basic call | Can talk to Claude |
| 1-3 | Build base.ts + parser.ts + context.ts | Core agent infrastructure works |
| 3-5 | Write prompts for tests + docker + cicd (the 3 most demoable) | 3 agents generating real code |
| 5-8 | Write prompts for remaining 5 buildings | All 8 agents working |
| 8-10 | Integrate with Backend 3's /chat and /accept endpoints | Chat flow works end-to-end |
| 10-14 | Test all 8 agents against real repos, refine prompts | Code quality is good |
| 14-18 | Handle edge cases: empty repos, weird languages, bad input | No crashes |
| 18-24 | Cache agent responses for demo repos, speed optimization | Demo is snappy |

### Mock data (for Frontend to use before you're ready)

Give this to Frontend on hour 0:

```json
{
  "explanation": "I've written tests for your auth routes. The tests cover login, signup, and token validation.",
  "files": [
    {
      "path": "tests/auth.test.ts",
      "content": "import { describe, it, expect } from 'vitest'\n\ndescribe('Auth Routes', () => {\n  it('should login with valid credentials', async () => {\n    // test code here\n  })\n})"
    }
  ]
}
```

---

## ⚙️ BACKEND 3 — INFRA GLUE

### What you own
You are the spine. You build the server that everyone plugs into.
You unblock everyone else. If you're slow, the whole team is blocked.

### Files you create

```
server/
├── src/
│   ├── index.ts              # Express + Socket.IO server setup
│   ├── routes/
│   │   ├── scan.ts           # POST /scan — triggers scanner, opens WebSocket
│   │   ├── chat.ts           # POST /chat — routes to AI agent
│   │   ├── accept.ts         # POST /accept — adds to change queue, updates state
│   │   └── export.ts         # POST /export — generates ZIP of all changes
│   ├── state/
│   │   ├── sessions.ts       # In-memory session state (buildings, scores, changes)
│   │   └── changes.ts        # Change queue per session
│   ├── export/
│   │   └── zip.ts            # Generate ZIP file from changes queue
│   └── types/
│       └── index.ts          # Shared TypeScript types for the whole backend
├── package.json
└── tsconfig.json
```

### Your server setup (index.ts)

```typescript
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
const server = createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.use(cors())
app.use(express.json())

// Routes
app.post('/scan', scanHandler)     // Triggers repo clone + scan
app.post('/chat', chatHandler)     // Sends message to building agent
app.post('/accept', acceptHandler) // Accepts generated code
app.post('/export', exportHandler) // Downloads changes as ZIP

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  // Scanner will emit to this socket
})

server.listen(3001, () => console.log('ShipCity server on :3001'))
```

### Session state (sessions.ts)

```typescript
interface Session {
  id: string
  repoUrl: string
  repoPath: string          // where the cloned repo lives on disk
  buildings: Record<string, BuildingState>
  changes: FileChange[]     // accepted code changes
  score: number
}

interface BuildingState {
  percent: number
  tasks: Task[]
  chatHistory: Message[]
}

// In-memory store (fine for hackathon)
const sessions: Record<string, Session> = {}
```

### How POST /scan works

```typescript
async function scanHandler(req, res) {
  const { url } = req.body
  const sessionId = generateId()

  // 1. Create session
  sessions[sessionId] = { id: sessionId, repoUrl: url, buildings: {}, changes: [], score: 0 }

  // 2. Return session ID immediately (don't wait for scan)
  res.json({ sessionId })

  // 3. Clone + scan in background, emit via WebSocket
  const socket = io.to(sessionId)
  const repoPath = await cloneRepo(url)         // Scanner's clone.ts
  sessions[sessionId].repoPath = repoPath
  await scanRepo(repoPath, socket, sessionId)    // Scanner's index.ts
}
```

Frontend joins the WebSocket room with sessionId to receive scan events.

### How POST /chat works

```typescript
async function chatHandler(req, res) {
  const { sessionId, building, message } = req.body
  const session = sessions[sessionId]

  // Get chat history for this building
  const history = session.buildings[building]?.chatHistory || []

  // Call the AI agent (Backend 2's code)
  const response = await handleAgentChat(building, message, history, session.repoPath)

  // Save to chat history
  session.buildings[building].chatHistory.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response.explanation, files: response.files }
  )

  res.json(response)
}
```

### How POST /accept works

```typescript
async function acceptHandler(req, res) {
  const { sessionId, building, files } = req.body
  const session = sessions[sessionId]

  // Add files to changes queue
  session.changes.push(...files.map(f => ({ ...f, building })))

  // Update building percentage (+25 per accepted change, cap at 100)
  const buildingState = session.buildings[building]
  buildingState.percent = Math.min(buildingState.percent + 25, 100)

  // Mark next incomplete task as done
  const nextTask = buildingState.tasks.find(t => !t.done)
  if (nextTask) nextTask.done = true

  // Recalculate overall score
  session.score = calculateScore(session.buildings)

  res.json({
    building,
    percent: buildingState.percent,
    tasks: buildingState.tasks,
    score: session.score
  })
}
```

### How POST /export works

```typescript
async function exportHandler(req, res) {
  const { sessionId } = req.body
  const session = sessions[sessionId]

  // Generate ZIP with all accepted changes
  const zipBuffer = await generateZip(session.changes)

  res.set('Content-Type', 'application/zip')
  res.set('Content-Disposition', 'attachment; filename=shipcity-fixes.zip')
  res.send(zipBuffer)
}
```

Use `archiver` npm package for ZIP generation.

### Your timeline

| Hour | Task | Delivers |
|---|---|---|
| 0-1 | Express + Socket.IO server running, CORS, types defined | Server exists, team can hit it |
| 1-2 | POST /scan endpoint + WebSocket room setup | Frontend can trigger a scan |
| 2-3 | Session state management | Server tracks sessions, buildings, scores |
| 3-4 | POST /chat endpoint (wired to Backend 2's agent) | Chat works end-to-end |
| 4-5 | POST /accept endpoint + building state updates | Accept → percentage increases |
| 5-7 | Wire Scanner (Backend 1) into Socket.IO emission | Scan results stream to frontend |
| 7-8 | POST /export + ZIP generation | User can download fixes |
| 8-10 | Full integration testing — all 3 backends working together | Complete backend pipeline |
| 10-14 | Bug fixes, error handling, edge cases | No crashes |
| 14-18 | Cache demo repos (pre-clone, pre-scan, pre-generate) | Demo is instant |
| 18-24 | Deploy to Railway, final bug fixes | Live backend |

### YOU ARE THE MOST IMPORTANT PERSON HOURS 0-5

If you don't have endpoints up by hour 3, everyone is blocked.
Priority order:
1. Server running with CORS ✅
2. POST /scan that emits fake scan data via WebSocket ✅
3. POST /chat that returns mock agent response ✅
4. POST /accept that returns updated percentage ✅

THEN wire in real scanner and real agents. Mock-first approach.

---

## 🎮 FRONTEND — VILLAGE + UI

### What you own
You build everything the judges see. The village, the UI, the magic.

### Files you create

```
frontend/src/
├── app/
│   ├── page.tsx                    # Landing page — URL input
│   └── village/
│       └── page.tsx                # Main village experience
│
├── components/
│   ├── scene/                      # 3D (React Three Fiber)
│   │   ├── Village.tsx             # Main R3F Canvas + scene
│   │   ├── Island.tsx              # Ground plane / terrain
│   │   ├── Building.tsx            # One building — loads model based on %
│   │   ├── BuildingSlot.tsx        # Empty lot placeholder
│   │   ├── CameraRig.tsx           # OrbitControls + initial animation
│   │   └── Lights.tsx              # Scene lighting + atmosphere
│   │
│   └── ui/                         # 2D panels overlaid on 3D
│       ├── ScoreBar.tsx            # Overall production readiness %
│       ├── BuildingPanel.tsx       # Right panel when building clicked
│       ├── TaskList.tsx            # Checklist inside building panel
│       ├── ChatWindow.tsx          # Chat with building agent
│       ├── CodePreview.tsx         # Monaco editor showing generated code
│       ├── ScanOverlay.tsx         # "Scanning..." progress during initial load
│       └── ExportButton.tsx        # Download ZIP
│
├── store/
│   └── useStore.ts                 # Zustand — all app state
│
├── hooks/
│   ├── useSocket.ts                # Socket.IO connection
│   └── useApi.ts                   # HTTP calls to backend
│
├── lib/
│   ├── buildings.ts                # Building registry: names, 3D positions, colors
│   └── types.ts                    # TypeScript types
│
└── public/
    └── models/                     # 3D assets (.glb files)
```

### Zustand store shape

```typescript
interface Store {
  // Scan state
  repoUrl: string
  sessionId: string | null
  scanStatus: 'idle' | 'scanning' | 'complete'
  score: number

  // Buildings
  buildings: Record<string, {
    percent: number
    tasks: Task[]
    status: 'waiting' | 'scanning' | 'done'
  }>

  // UI state
  activeBuilding: string | null    // which building is clicked
  chatHistory: Record<string, Message[]>
  pendingFiles: FileChange[]       // code preview before accept

  // Actions
  setRepoUrl: (url: string) => void
  startScan: (sessionId: string) => void
  updateBuilding: (building: string, data: Partial<BuildingState>) => void
  setActiveBuilding: (building: string | null) => void
  addChatMessage: (building: string, message: Message) => void
  setPendingFiles: (files: FileChange[]) => void
  acceptChanges: () => void
}
```

### Building registry (buildings.ts)

```typescript
export const BUILDINGS = {
  tests:      { name: 'School',        emoji: '🏫', position: [-4, 0, -3], color: '#4CAF50' },
  cicd:       { name: 'Factory',       emoji: '🏭', position: [0, 0, -4],  color: '#FF9800' },
  docker:     { name: 'Shipping Dock', emoji: '🚢', position: [4, 0, -3],  color: '#2196F3' },
  docs:       { name: 'Town Hall',     emoji: '🏛️', position: [-3, 0, 1],  color: '#9C27B0' },
  envVars:    { name: 'Power Plant',   emoji: '⚡', position: [3, 0, 1],   color: '#FFC107' },
  security:   { name: 'Vault',         emoji: '🔒', position: [-4, 0, 4],  color: '#F44336' },
  logging:    { name: 'Watchtower',    emoji: '🗼', position: [0, 0, 4],   color: '#00BCD4' },
  deployment: { name: 'Launch Pad',    emoji: '🚀', position: [4, 0, 4],   color: '#E91E63' },
}
```

### Building.tsx — The core visual component

```
Each building renders based on percent:

0%   → Flat grey pad on the ground (BoxGeometry, very flat)
25%  → Small structure, partially transparent, scaffolding color
50%  → Half-height building, solid bottom, transparent top
75%  → Full height but muted/grey colors
100% → Full height, bright color, subtle glow effect

Start with simple BoxGeometry. Upgrade to real models if time allows.
The height of the box = (percent / 100) * maxHeight.
This alone looks great when buildings grow live during scan.
```

### How the progressive scan looks on your end

```typescript
// useSocket.ts
socket.on('scan:scanning', ({ building }) => {
  useStore.getState().updateBuilding(building, { status: 'scanning' })
  // Show a pulsing indicator on that building plot
})

socket.on('scan:result', ({ building, percent, tasks }) => {
  useStore.getState().updateBuilding(building, {
    status: 'done',
    percent,
    tasks
  })
  // Building transitions from flat pad to its scored height
  // This is the "village building live" moment
})

socket.on('scan:complete', ({ score }) => {
  // Show final score, enable building clicks
})
```

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [ScoreBar: 34% Production Ready]                [Export]   │
│                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │
│  │                          │  │  BuildingPanel            │ │
│  │    3D Village Scene      │  │  ┌──────────────────────┐ │ │
│  │    (React Three Fiber)   │  │  │ 🏫 School — 25%      │ │ │
│  │                          │  │  │                      │ │ │
│  │    [Click buildings      │  │  │ Tasks:               │ │ │
│  │     to interact]         │  │  │ ☑ Install jest       │ │ │
│  │                          │  │  │ ☐ Add test files     │ │ │
│  │                          │  │  │ ☐ Add test script    │ │ │
│  │                          │  │  │ ☐ 50% coverage       │ │ │
│  │                          │  │  └──────────────────────┘ │ │
│  │                          │  │  ┌──────────────────────┐ │ │
│  │                          │  │  │ Chat                 │ │ │
│  │                          │  │  │ > Write tests for    │ │ │
│  │                          │  │  │   my auth routes     │ │ │
│  │                          │  │  │                      │ │ │
│  │                          │  │  │ [Agent response...]  │ │ │
│  │                          │  │  │ [Code Preview]       │ │ │
│  │                          │  │  │ [Accept] [Reject]    │ │ │
│  │                          │  │  └──────────────────────┘ │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Village takes ~60% width. Panel takes ~40% width.
Panel only shows when a building is clicked.
```

### Your timeline

| Hour | Task | Delivers |
|---|---|---|
| 0-1 | Next.js app scaffolded, R3F installed, basic Canvas rendering | Something on screen |
| 1-3 | Island ground plane + 8 building slots positioned + orbit camera | Navigable empty island |
| 3-5 | Buildings render as colored boxes based on mock data percent | Village looks like something |
| 5-7 | Click detection on buildings + BuildingPanel opens | Can click → see tasks |
| 7-9 | Connect to real WebSocket — buildings update during scan | Progressive build works! |
| 9-11 | ChatWindow + CodePreview components | Can chat with agents |
| 11-14 | Accept flow — click accept → building grows → score updates | CORE FLOW COMPLETE |
| 14-16 | Visual polish — building transitions, colors, lighting | Looks good |
| 16-18 | ScanOverlay, ScoreBar, ExportButton | UI is complete |
| 18-20 | Deploy to Vercel, responsive fixes | Live and stable |
| 20-24 | Final art pass — glow effects, better models if time, particles | Demo-ready |

### Critical rule: COLORED BOXES FIRST

Do NOT spend hours 0-8 trying to load .glb models or make things pretty.
Colored BoxGeometry that grows in height based on percent is enough for
the core flow. If you nail that by hour 8, you have 16 hours to make it
beautiful. If you try to make it beautiful first, you'll have nothing by hour 14.

```typescript
// This is enough for hours 0-8:
function Building({ building, percent }) {
  const height = 0.1 + (percent / 100) * 3  // 0.1 at 0%, 3.1 at 100%
  const color = percent === 100 ? BUILDINGS[building].color : '#888'

  return (
    <mesh position={[...BUILDINGS[building].position]}>
      <boxGeometry args={[1.5, height, 1.5]} />
      <meshStandardMaterial color={color} transparent opacity={percent === 0 ? 0.3 : 1} />
    </mesh>
  )
}
```

---

## SHARED TYPES (everyone uses these)

```typescript
// types/index.ts — Backend 3 creates this on hour 0, everyone imports it

interface Task {
  id: string
  label: string
  done: boolean
}

interface BuildingState {
  building: string
  percent: 0 | 25 | 50 | 75 | 100
  tasks: Task[]
  details: string
}

interface ScanEvent {
  type: 'scanning' | 'result' | 'complete'
  building?: string
  percent?: number
  tasks?: Task[]
  score?: number
}

interface ChatRequest {
  sessionId: string
  building: string
  message: string
}

interface ChatResponse {
  explanation: string
  files: FileChange[]
}

interface FileChange {
  path: string
  content: string
}

interface AcceptRequest {
  sessionId: string
  building: string
  files: FileChange[]
}

interface AcceptResponse {
  building: string
  percent: number
  tasks: Task[]
  score: number
}
```

---

## MVP — THE MINIMUM THAT WINS

If you only get this far, you can still win:

1. ✅ Paste GitHub URL → repo clones
2. ✅ 8 buildings get scored (even if analysis is basic)
3. ✅ Village renders with boxes at correct heights
4. ✅ Buildings appear progressively (not all at once)
5. ✅ Click a building → see tasks
6. ✅ Chat with agent → get generated code
7. ✅ Accept code → building grows → score increases
8. ✅ Looks decent (not beautiful, decent)

If you ALSO get:
- Nice 3D models instead of boxes
- Smooth building animations
- Export as ZIP
- Scout NPC dialogue
- Deployed to a real URL

Then you're in the top 2.

---

## BIGGEST RISKS AND FIXES

### Risk 1: Three.js eats the frontend alive
**Probability: HIGH**
Fix: Colored boxes for hours 0-14. Period. No .glb files until
the core flow works. The frontend dev must resist the urge to make
it pretty before it works.

### Risk 2: Claude generates garbage code
**Probability: MEDIUM**
Fix: Backend 2 pre-tests all 8 prompts against a demo repo by hour 10.
Refine prompts until output is solid. Cache known-good responses for demo.

### Risk 3: Repo cloning is slow during demo
**Probability: HIGH**
Fix: Backend 3 pre-clones 2-3 demo repos before the presentation.
When those URLs are pasted, serve cached results instantly.

### Risk 4: Integration fails at hour 14
**Probability: MEDIUM**
Fix: Everyone uses mock data from hour 0. Integration is gradual —
replace mocks one by one. Never do a "big merge" at the end.

### Risk 5: Scope creep
**Probability: HIGH**
Fix: If anyone says "what if we also add..." after hour 10, the answer
is no. Focus on making the core flow flawless, not adding features.

---

## HOUR-BY-HOUR MASTER TIMELINE

```
HOUR 0-1: SETUP
  All: Git repo, npm install, agree on types, share mock data
  Backend 3: Server running, CORS, first endpoint up

HOUR 1-3: BUILD INDEPENDENTLY
  Scanner:    Clone repos, first 3 analyzers
  AI Agents:  Claude client, base agent, 1 prompt working
  Infra:      All 4 endpoints returning mock data
  Frontend:   R3F canvas, island, 8 building slots

HOUR 3-5: FIRST INTEGRATION
  Scanner → Infra: Wire scan results into Socket.IO
  Frontend → Infra: Connect to WebSocket, buildings update from mock scan
  Goal: Paste URL → see buildings appear (even with fake data)

HOUR 5-8: CORE FEATURES
  Scanner:    All 8 analyzers done
  AI Agents:  3 agents generating real code
  Infra:      /chat and /accept wired to real agents
  Frontend:   BuildingPanel, TaskList, ChatWindow, CodePreview

HOUR 8-10: SECOND INTEGRATION
  Everything wired together with real data.
  Goal: Paste URL → real scan → real buildings → click → real chat → real code

HOUR 10-14: MAKE IT WORK PERFECTLY
  Everyone: Test with real repos, fix bugs, handle edge cases
  This is the grind. No new features. Just make it solid.
  ⚠️ HOUR 14 CHECKPOINT: Core flow works end-to-end? YES/NO.
  If NO: Cut features until it does.

HOUR 14-18: POLISH
  Frontend: Better visuals, animations, score bar, export button
  Backend: Cache demo repos, optimize speed, error handling
  All: Bug fixes, edge cases, deploy

HOUR 18-22: DEMO PREP
  Deploy frontend + backend
  Test on real URL end-to-end
  Rehearse demo 3 times
  Record backup video
  Write submission

HOUR 22-24: FINAL TOUCHES
  Sleep is optional. Confidence is not.
  Last bug fixes only. No new features.
```

---

## DEMO SCRIPT (2 minutes)

**[0:00-0:10]**
"Every developer has a side project that works on their laptop
but will never see production. ShipCity shows you why — and fixes it."

**[0:10-0:30]**
*Paste GitHub URL. Island appears. "Surveying the land..."*
*Buildings start rising one by one. Most are empty or tiny.*
"This repo scores 28%. That's a ghost town."

**[0:30-0:55]**
*Click on empty Factory (CI/CD).*
*Tasks appear: no workflows, no pipeline, no deploy step.*
*Type in chat: "Set up CI/CD for this project"*
*Agent generates a real GitHub Actions workflow for their stack.*

**[0:55-1:15]**
*Click Accept. Factory building grows from 0% to 25%.*
*Score ticks up.*
"That's a real workflow file. For their actual project. One click."

**[1:15-1:40]**
*Speed round: fix School (tests) → building grows.*
*Fix Shipping Dock (Docker) → building grows.*
*Village is visibly transforming from ghost town to alive.*

**[1:40-1:55]**
"We went from 28% to 55% in three clicks. Every fix is real code,
generated for this specific repo, by specialized AI agents who
understand exactly what each building needs."

**[1:55-2:00]**
"ShipCity. Your codebase is a village. How alive is yours?"
