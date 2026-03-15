// server/src/agents/analyzer.ts
// Deep analysis agent: ONE LLM call to analyze ALL buildings at once.
// Replaces the old per-building analyzeForTasks + dedup flow (9 calls → 1).
// The model sees every building's scanner results + repo context in a single
// prompt, so it naturally avoids cross-building duplication.

import Anthropic from '@anthropic-ai/sdk'
import type { AnalyzerResult, BuildingId, Task } from '../types'
import { buildSlimContext } from './context'
import { buildScannerPreprompt } from './scanner-context'
import { client } from './client'

const ALL_BUILDINGS: BuildingId[] = [
  'tests', 'cicd', 'docker', 'documentation', 'envVars', 'security', 'logging', 'deployment',
]

const BUILDING_DOMAINS: Record<BuildingId, string> = {
  tests: 'test framework, test files, test coverage, test scripts',
  cicd: 'CI/CD pipelines, GitHub Actions, build/test automation workflows',
  docker: 'Dockerfile, docker-compose, .dockerignore, container best practices',
  documentation: 'README quality, API documentation, setup instructions, code comments',
  envVars: '.env files, environment variable management, config loading, hardcoded config',
  security: 'secrets in code, .gitignore coverage, input validation, auth, CORS, HTTP headers',
  logging: 'logging library, log levels, structured logging, request logging, log configuration',
  deployment: 'deploy config, build/start scripts, PORT binding, health checks, production readiness',
}

/**
 * Single LLM call that analyzes all buildings at once.
 * Returns a map of buildingId → additional tasks the scanner missed.
 * Replaces analyzeForTasks (8 calls) + deduplicateAcrossBuildings (1 call) = 9 calls → 1.
 */
export async function analyzeAllBuildings(params: {
  repoPath: string
  scanResults: AnalyzerResult[]
}): Promise<Map<BuildingId, Task[]>> {
  const { repoPath, scanResults } = params

  // Build one slim context (shared across buildings — it's the same repo)
  // Use 'deployment' as the key since it reads the widest set of config files
  const context = await buildSlimContext('deployment', repoPath)

  // Build scanner summaries for all buildings
  const scannerSummaries = scanResults.map((r) => {
    const preprompt = buildScannerPreprompt(r)
    return `### ${r.buildingId.toUpperCase()}\n${preprompt}`
  }).join('\n\n')

  // Build the domain list
  const domainList = ALL_BUILDINGS.map((b) => `- **${b}**: ${BUILDING_DOMAINS[b]}`).join('\n')

  const systemPrompt = `You are a codebase analyzer for ShipCity. You review repositories and identify additional tasks that a heuristic scanner missed.

You are analyzing ALL 8 building domains in a single pass. Each building has a specific domain — do not cross boundaries.

## Building Domains
${domainList}

## Repository Context
${context}`

  const userMessage = `## Scanner Results (all 8 buildings)

${scannerSummaries}

---

For each building, generate additional tasks the scanner missed. Follow these rules:

1. **Task dependency**: If the FOUNDATION for a domain doesn't exist (e.g., no Dockerfile, no CI config, no test framework), return an EMPTY array for that building. Only add refinement tasks for things that ALREADY EXIST but need improvement.

2. **No cross-building duplication**: Each task belongs to exactly ONE building. You see all 8 buildings at once — assign each issue to the single most relevant building.

3. **Be specific**: Reference actual files, functions, or patterns from the repo context. Not generic advice.

4. **Max 4 tasks per building**. Return fewer if fewer are needed. Return [] if the scanner already covers everything.

5. Task IDs must start with the building prefix (e.g., "tests-...", "docker-...").

Return ONLY a JSON object mapping each building to its task array. No markdown fences, no explanation:
{
  "tests": [{"id": "tests-...", "label": "...", "done": false}],
  "cicd": [],
  "docker": [],
  "documentation": [...],
  "envVars": [],
  "security": [],
  "logging": [],
  "deployment": []
}`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      cwd: repoPath,
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, Task[]>

    const result = new Map<BuildingId, Task[]>()
    for (const buildingId of ALL_BUILDINGS) {
      const tasks = parsed[buildingId]
      if (Array.isArray(tasks)) {
        result.set(
          buildingId,
          tasks
            .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.done === 'boolean')
            .map((t) => ({ id: t.id, label: t.label, done: t.done }))
        )
      } else {
        result.set(buildingId, [])
      }
    }

    return result
  } catch (err) {
    console.error('Deep analysis failed, returning empty tasks:', err)
    const empty = new Map<BuildingId, Task[]>()
    for (const b of ALL_BUILDINGS) empty.set(b, [])
    return empty
  }
}

/**
 * Merge scanner tasks with analysis agent tasks.
 * Scanner tasks come first, agent tasks are appended.
 * Deduplicates by ID.
 */
export function mergeTasks(scannerTasks: Task[], agentTasks: Task[]): Task[] {
  const seen = new Set(scannerTasks.map((t) => t.id))
  const merged = [...scannerTasks]

  for (const task of agentTasks) {
    if (!seen.has(task.id)) {
      seen.add(task.id)
      merged.push(task)
    }
  }

  return merged
}
