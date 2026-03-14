// server/src/agents/analyzer.ts
// Analysis agent: after the scanner's heuristic pass, calls the building's
// specialist agent to review actual code and generate deeper tasks.
// Returns structured JSON — does NOT edit files (that's aider's job).

import Anthropic from '@anthropic-ai/sdk'
import type { AnalyzerResult, BuildingId, Task } from '../types'
import { AGENT_PROMPTS } from './prompts'
import { buildAgentContext } from './context'
import { buildScannerPreprompt } from './scanner-context'
import { client } from './client'

const ANALYSIS_PROMPT = `Based on your analysis of the repository, generate a list of ADDITIONAL tasks
that the scanner missed. The scanner only checks surface-level things (file exists, dependency installed).
You should check for deeper issues like:

- Code quality problems specific to your domain
- Missing best practices
- Configuration gaps
- Security concerns the regex didn't catch
- Things that exist but are poorly implemented

Return ONLY a JSON array of task objects. No markdown, no explanation, just the array:
[
  { "id": "unique-id", "label": "Human-readable task description", "done": false },
  ...
]

Rules:
- Each task ID must be unique and descriptive (e.g., "tests-missing-route-coverage")
- Each label should be specific and actionable (e.g., "Add tests for DELETE /api/books/:id route")
- Do NOT repeat tasks the scanner already found — only add NEW ones
- Only add tasks that are genuinely incomplete — if something is already done well, don't add a task for it
- Keep it to 2-6 additional tasks — focus on the most impactful ones
- Set done to true if you see the repo already handles it, false if it doesn't`

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
      messages: [{ role: 'user', content: ANALYSIS_PROMPT }],
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
