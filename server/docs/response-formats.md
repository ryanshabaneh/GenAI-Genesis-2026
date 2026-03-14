# Response Format Standards

All format instructions live in **`src/agents/prompts/formats.ts`** — the single source of truth.

Agents import the format constant they need. No agent should define its own format instructions inline.

## SDK Response Extraction

All LLM calls use the Anthropic SDK (`@anthropic-ai/sdk`). The SDK returns `response.content` as an array of content blocks. Every agent extracts text the same way:

```ts
const text = response.content
  .filter((block): block is Anthropic.TextBlock => block.type === 'text')
  .map((block) => block.text)
  .join('')
```

This is **not** the Claude CLI — there is no JSON envelope to unwrap.

## Format Constants (`src/agents/prompts/formats.ts`)

| Constant | Used by | Output shape | Fences allowed? |
|----------|---------|--------------|-----------------|
| `CHAT_FORMAT` | Chat agent (`base.ts`) | Text + `// File:` code blocks | N/A (free-form) |
| `IMPLEMENTATION_FORMAT` | Implementation agent (`base.ts`) | Free-form instructions for aider | N/A (free-form) |
| `ANALYZER_FORMAT` | Analyzer (`analyzer.ts`) | `Task[]` JSON array | Yes (stripped) |
| `DEDUP_FORMAT` | Deduplicator (`analyzer.ts`) | `Record<BuildingId, Task[]>` JSON | Yes (stripped) |
| `EVALUATOR_FORMAT` | Evaluator (`evaluator.ts`) | `EvaluatorResult` JSON object | No (will break parser) |
| `REPO_EVALUATOR_FORMAT` | Repo evaluator (`evaluator.ts`) | `EvaluatorResult` JSON object | No (will break parser) |

## How Each Format Works

### `CHAT_FORMAT` — text with optional code blocks

Appended to every building's system prompt via `AGENT_PROMPTS` in `prompts/index.ts`.

```
// File: src/lib/logger.ts
```typescript
import pino from 'pino'
export const logger = pino({ level: 'info' })
```
```

**Parsing (`base.ts` → `parseCodeBlocks`):**
```ts
const pattern = /(?:\/\/\s*File:\s*(.+?)\n)?```(\w+)?\n([\s\S]*?)```/g
```

Extracts `{ path, content, language }` per block. Defaults: path=`'snippet'`, language=`'text'`.

### `IMPLEMENTATION_FORMAT` — free-form instructions for aider

Appended to the building system prompt in `callAgentForImplementation()`.

**No parsing.** Raw text is passed directly to aider as `--message`.

### `ANALYZER_FORMAT` — JSON task array

Included in the user message in `analyzeForTasks()`.

```json
[
  { "id": "tests-001", "label": "Add unit test for POST /api/users", "done": false }
]
```

**Parsing:**
```ts
const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
const tasks = JSON.parse(cleaned) as Task[]
```

**Validation:** Each task must have `id` (string), `label` (string), `done` (boolean). Invalid entries filtered out.

### `DEDUP_FORMAT` — JSON building→tasks map

Included in the user message in `deduplicateAcrossBuildings()`.

```json
{
  "tests": [{ "id": "...", "label": "...", "done": false }],
  "security": [{ "id": "...", "label": "...", "done": false }]
}
```

**Parsing:** Same fence-stripping as analyzer. Parse failure returns original undeduped input.

### `EVALUATOR_FORMAT` / `REPO_EVALUATOR_FORMAT` — raw JSON (no fences)

Included in the system prompt constants `EVALUATOR_SYSTEM_PROMPT` and `REPO_EVALUATOR_SYSTEM_PROMPT`.

```json
{ "pass": true, "feedback": "", "summary": "Added 5 unit tests" }
```

| Field | Type | Description |
|-------|------|-------------|
| `pass` | boolean | Whether the implementation meets requirements |
| `feedback` | string | What needs fixing (empty if pass=true) |
| `summary` | string | 1-2 sentence description of what was accomplished |

**Parsing:** Direct `JSON.parse`. No fence stripping — fences will cause a parse error caught by the catch block.

## Error Handling

| Agent | On parse failure |
|-------|-----------------|
| Analyzer | Returns `[]` (no tasks discovered) |
| Deduplicator | Returns original undeduped tasks |
| Evaluator | Returns `{ pass: false, feedback: <error> }` |
| Chat | Returns reply with empty `codeBlocks` |
| Implementation | N/A (no parsing) |

## Adding a New Agent

1. **Add a format constant** to `src/agents/prompts/formats.ts`
2. **Export it** from `src/agents/prompts/index.ts`
3. **Import and use it** in your agent file — never define format instructions inline
4. **Decide: fences or no fences.** Pick one and be explicit in the format string.
   - If allowing fences: strip with `text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()`
   - If forbidding fences: include "no markdown fences" in the format string
5. **Always validate** the parsed shape before using it
6. **Always have a catch block** that returns a safe default
7. **Update this doc** with the new format
