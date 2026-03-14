// server/src/agents/analyzer.ts
// Analysis agent: after the scanner's heuristic pass, calls the building's
// specialist agent to review actual code and generate deeper tasks.
// Returns structured JSON — does NOT edit files (that's aider's job).
// Includes a dedup pass to remove cross-building overlap.

import Anthropic from '@anthropic-ai/sdk'
import type { AnalyzerResult, BuildingId, Task } from '../types'
import { AGENT_PROMPTS } from './prompts'
import { buildAgentContext } from './context'
import { buildScannerPreprompt } from './scanner-context'
import { client } from './client'

// Domain boundaries — tells each agent what IS and ISN'T its responsibility
const DOMAIN_BOUNDARIES: Record<BuildingId, string> = {
  tests: `Your domain is ONLY: test framework, test files, test coverage, test scripts.
Do NOT flag: security issues, missing env vars, deployment config, Docker, CI/CD, logging, or documentation.`,

  cicd: `Your domain is ONLY: CI/CD pipelines, GitHub Actions, build/test automation workflows.
Do NOT flag: security issues, missing tests, env vars, Docker, logging, deployment config, or documentation.`,

  docker: `Your domain is ONLY: Dockerfile quality, docker-compose, .dockerignore, container best practices.
Do NOT flag: security issues, missing tests, env vars, CI/CD, logging, deployment config, or documentation.`,

  documentation: `Your domain is ONLY: README quality, API documentation, setup instructions, code comments.
Do NOT flag: security issues, missing tests, env vars, Docker, CI/CD, logging, or deployment config.`,

  envVars: `Your domain is ONLY: environment variable management, .env files, config loading, hardcoded config values.
Do NOT flag: general security issues, missing tests, Docker, CI/CD, logging, deployment config, or documentation.`,

  security: `Your domain is ONLY: secrets in code, .gitignore coverage, input validation, auth, CORS, HTTP security headers.
Do NOT flag: missing tests, env var management, Docker, CI/CD, logging, deployment config, or documentation.`,

  logging: `Your domain is ONLY: logging library, log levels, structured logging, request logging, log configuration.
Do NOT flag: security issues, missing tests, env vars, Docker, CI/CD, deployment config, or documentation.`,

  deployment: `Your domain is ONLY: deploy config, build/start scripts, PORT binding, health checks, graceful shutdown, production readiness.
Do NOT flag: security issues, missing tests, env vars, Docker, CI/CD, logging, or documentation.`,
}

function buildAnalysisPrompt(buildingId: BuildingId): string {
  const boundary = DOMAIN_BOUNDARIES[buildingId]

  return `Based on your analysis of the repository, generate a list of ADDITIONAL tasks
that the scanner missed. The scanner only checks surface-level things (file exists, dependency installed).
You should check for deeper issues WITHIN YOUR DOMAIN ONLY.

${boundary}

Return ONLY a JSON array of task objects. No markdown, no explanation, just the array:
[
  { "id": "unique-id", "label": "Human-readable task description", "done": false },
  ...
]

Rules:
- Each task ID must start with your building prefix (e.g., "${buildingId}-...")
- Each label should be specific and actionable (e.g., "Add tests for DELETE /api/books/:id route")
- Do NOT repeat tasks the scanner already found — only add NEW ones
- STAY IN YOUR DOMAIN — do not flag issues that belong to other buildings
- Only add tasks that are genuinely incomplete — if something is already done well, don't add a task for it
- Focus on the most impactful issues
- Set done to true if you see the repo already handles it, false if it doesn't`
}

/**
 * Call the building's specialist agent to analyze the repo and generate
 * additional tasks beyond what the scanner found heuristically.
 */
export async function analyzeForTasks(params: {
  buildingId: BuildingId
  repoPath: string
  scanResult: AnalyzerResult
}): Promise<Task[]> {
  const { buildingId, repoPath, scanResult } = params

  const systemPrompt = AGENT_PROMPTS[buildingId]
  const context = await buildAgentContext(buildingId, repoPath)
  const scannerPreprompt = buildScannerPreprompt(scanResult)

  const fullSystem = `${systemPrompt}\n\n---\n\n${scannerPreprompt}\n\n---\n\n${context}`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: fullSystem,
      messages: [{ role: 'user', content: buildAnalysisPrompt(buildingId) }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Parse JSON from response — handle markdown fences if model wraps it
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const tasks = JSON.parse(cleaned) as Task[]

    // Validate structure
    if (!Array.isArray(tasks)) return []

    return tasks
      .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.done === 'boolean')
      .map((t) => ({ id: t.id, label: t.label, done: t.done }))
  } catch (err) {
    console.error(`Analysis agent error for ${buildingId}:`, err)
    return []
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

/**
 * Dedup tasks across all buildings after all analysis agents have run.
 * Uses keyword overlap in task labels to detect duplicates.
 * When a duplicate is found, keeps it in the most relevant building
 * (determined by RELEVANCE_MAP) and removes it from others.
 */

// Which building should "own" cross-cutting issues
const OWNERSHIP: Record<string, BuildingId> = {
  'secret': 'security',
  'api key': 'security',
  'hardcoded key': 'security',
  'credential': 'security',
  'auth': 'security',
  'cors': 'security',
  'helmet': 'security',
  'validation': 'security',
  'sanitize': 'security',
  'injection': 'security',
  'prototype pollution': 'security',
  'mass assignment': 'security',
  'error handling': 'logging',
  'error middleware': 'logging',
  'unhandled': 'logging',
  'dead code': 'documentation',
  'unused': 'documentation',
  'in-memory': 'deployment',
  'persist': 'deployment',
  'database': 'deployment',
}

/**
 * Check if a task label matches a cross-cutting concern that belongs to a specific building.
 */
function findOwner(label: string): BuildingId | null {
  const lower = label.toLowerCase()
  for (const [keyword, owner] of Object.entries(OWNERSHIP)) {
    if (lower.includes(keyword)) return owner
  }
  return null
}

/**
 * Remove cross-building duplicates. For each building's agent tasks,
 * drop any task whose topic belongs to a different building's domain.
 */
export function deduplicateAcrossBuildings(
  allResults: Map<BuildingId, Task[]>
): Map<BuildingId, Task[]> {
  const deduped = new Map<BuildingId, Task[]>()

  for (const [buildingId, tasks] of allResults) {
    const filtered = tasks.filter((task) => {
      const owner = findOwner(task.label)
      // Keep if: no cross-cutting owner found, or this IS the owning building
      return owner === null || owner === buildingId
    })
    deduped.set(buildingId, filtered)
  }

  return deduped
}
