# Agent Architecture

## Overview

ShipCity uses a multi-agent system to scan, analyze, chat about, and implement code improvements across 8 building domains. All LLM calls go through the **Anthropic SDK** (`@anthropic-ai/sdk`), not the Claude CLI.

```
User enters repo URL
        │
        ▼
┌──────────────┐
│  POST /scan  │ → clone repo → run 8 heuristic analyzers
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Deep Analysis   │ → LLM-powered analyzer agents find tasks scanners missed
│  (per building)  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Cross-Building  │ → LLM dedup removes duplicate tasks across buildings
│  Deduplication   │
└──────┬───────────┘
       │
       ▼
  Results streamed to frontend via Socket.IO
       │
       ├──────────────────────────────┐
       ▼                              ▼
┌──────────────┐              ┌────────────────┐
│  POST /chat  │              │ POST /implement│
│  (Q&A mode)  │              │ (build mode)   │
└──────┬───────┘              └───────┬────────┘
       │                              │
       ▼                              ▼
┌──────────────┐              ┌────────────────────────────────┐
│  callAgent() │              │  Agent → Aider → Evaluator     │
│  returns text│              │  (brain)  (hands)  (inspector) │
│  + codeBlocks│              │  up to 3 iterations            │
└──────────────┘              └────────────────────────────────┘
```

## Agents

### 1. Analyzer Agent (`agents/analyzer.ts`)

**Purpose:** Reads actual source code to discover tasks the heuristic scanner missed.

**When called:** During scan, after heuristic analyzers finish.

**Input:**
- Building-specific domain prompt with strict boundaries
- Scanner findings (what was already detected)
- Repo file contents via `buildAgentContext()`

**Output format:** JSON array of `Task` objects.

**Parsing:** Strips markdown fences (```` ```json ````) then `JSON.parse`. Validates each task has `id` (string), `label` (string), `done` (boolean). Returns `[]` on failure.

### 2. Deduplication Agent (`agents/analyzer.ts` → `deduplicateAcrossBuildings`)

**Purpose:** Removes duplicate tasks that multiple buildings flagged.

**When called:** After all analyzer agents finish, once per scan.

**Input:** All tasks from all 8 buildings as a JSON map.

**Output format:** `Record<BuildingId, Task[]>` — deduplicated map.

**Parsing:** Strips markdown fences then `JSON.parse`. Returns original (undeduped) tasks on failure.

### 3. Chat Agent (`agents/base.ts` → `callAgent`)

**Purpose:** Conversational specialist for a building domain. Answers questions and suggests code.

**When called:** On every `POST /api/chat` message.

**Input:**
- Building's system prompt (`AGENT_PROMPTS[buildingId]`)
- Scanner preprompt (findings + task list)
- Change log context (what other buildings completed)
- Repo file context via `buildAgentContext()`
- Full conversation history for that building

**Output format:** Free-form text with optional code blocks in `// File: path` format.

**Parsing:** Regex extracts code blocks matching `// File: path\n```lang\n...content...\n``` `. Returns `AgentReply` with `content` (full text) and optional `codeBlocks[]`.

### 4. Implementation Agent (`agents/base.ts` → `callAgentForImplementation`)

**Purpose:** The "brain" — produces specific implementation instructions for aider to execute.

**When called:** By the orchestrator before each aider run, and again on evaluator failure with feedback.

**Input:** Same as chat agent, plus an instruction suffix telling it to output for a code editor (not a human).

**Output format:** Free-form text — precise implementation instructions.

**Parsing:** None. Raw text is passed directly to aider as `--message`.

### 5. Evaluator Agent (`agents/evaluator.ts` → `callEvaluator`)

**Purpose:** Quality inspector — checks whether aider's output actually implements the requested tasks.

**When called:** After each aider run in the orchestrator loop.

**Input:**
- Task list (what should have been implemented)
- Aider's git diff
- Changed file contents

**Output format:** Raw JSON object (no markdown fences).

**Parsing:** Direct `JSON.parse`. Coerces `pass` to boolean, defaults `feedback` and `summary` to `''`. Returns `{ pass: false }` on parse failure.

### 6. Aider (`agents/aider.ts`)

**Purpose:** The "hands" — a code editing tool that reads the repo via tree-sitter and writes files to disk.

**Not an LLM agent in our system.** Aider is spawned as a CLI subprocess. It has its own internal LLM call.

**When called:** By the orchestrator after the implementation agent produces instructions.

**Input:** Agent-generated instructions as `--message` flag.

**Output:** Git diff + list of changed/created files read from disk.

## Implementation Loop (Orchestrator)

```
POST /api/implement
        │
        ▼
  Build task message from selected tasks + optional user instructions
        │
        ▼
  callAgentForImplementation()  ← uses conversation history + scan context
        │
        ▼
  ┌─── Retry loop (max 3 iterations) ──────────────────────┐
  │                                                         │
  │  callAider(agentInstructions)                           │
  │      │                                                  │
  │      ▼                                                  │
  │  callEvaluator(tasks, diff, changedFiles)               │
  │      │                                                  │
  │      ├─ pass=true  → accept changes, mark tasks done    │
  │      │               add to changeLog, break            │
  │      │                                                  │
  │      └─ pass=false → reset aider changes                │
  │                      callAgentForImplementation() again  │
  │                      with evaluator feedback             │
  │                      loop continues                      │
  └─────────────────────────────────────────────────────────┘
```

Key: evaluator feedback routes back to the **agent** (not aider). The agent refines its instructions with full conversation context, then aider executes the refined version.

## Cross-Building Awareness

Every completed task is logged in the session's `changeLog`:
```ts
{ taskId, taskLabel, buildingId, summary, filesChanged, completedAt }
```

When any agent runs (chat or implement), it receives a change log context block showing what other buildings have already done. This prevents conflicts (e.g., two buildings both trying to create a logger) and enables coordination.

## Session State

All state lives in an in-memory `Map<string, Session>`:

```ts
{
  id: string
  repoUrl: string
  repoPath: string                              // cloned repo on disk
  results: Record<BuildingId, AnalyzerResult>   // scan results per building
  conversations: Record<BuildingId, Message[]>  // chat history per building
  changes: AcceptedChange[]                     // accepted code changes
  changeLog: ChangeLogEntry[]                   // cross-building log
}
```

Conversation history is summarized when it exceeds 50 messages (older messages condensed, last 20 kept verbatim).

## Building IDs

```ts
'tests' | 'cicd' | 'docker' | 'documentation' | 'envVars' | 'security' | 'logging' | 'deployment'
```

Each building has a specialist system prompt in `agents/prompts/index.ts`.
