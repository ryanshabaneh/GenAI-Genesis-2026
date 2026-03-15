import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'
import { client } from './client'
import { buildAgentContext } from './context'
import { EVALUATOR_FORMAT, BATCH_REPO_EVALUATOR_FORMAT } from './prompts'
import type { BuildingId, EvaluatorResult, Task } from '../types'

/**
 * Strip markdown fences from LLM output that should be raw JSON.
 * Handles ```json ... ``` and ``` ... ``` wrapping.
 */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/m)
  return fenced ? fenced[1].trim() : trimmed
}

const EVALUATOR_SYSTEM_PROMPT = `You are the Quality Inspector for Shipyard.

You receive:
1. A list of tasks the builder was asked to complete
2. The builder's response including code blocks

Your job is to evaluate whether the builder's output actually solves the tasks. Check:
- Are all incomplete tasks addressed by the code?
- Is the code syntactically valid (no obvious parse errors)?
- Does the code match the project stack (e.g. TypeScript for a TS project)?
- Are there any stubs, TODOs, placeholder comments, or "implement me" markers?
- Would the code actually work if applied to the project?

${EVALUATOR_FORMAT}`

export async function callEvaluator(params: {
  buildingId: string
  repoPath: string
  tasks: Task[]
  builderResponse: string
  codeBlocks: Array<{ path: string; content: string; language: string }>
}): Promise<EvaluatorResult> {
  const { buildingId, repoPath, tasks, builderResponse, codeBlocks } = params

  const incompleteTasks = tasks.filter((t) => !t.done)

  const userMessage = `## Building: ${buildingId}

## Tasks the builder was asked to complete:
${incompleteTasks.map((t) => `- [ ] ${t.label}`).join('\n')}

## Builder's response:
${builderResponse}

## Code blocks produced (${codeBlocks.length}):
${codeBlocks.map((b) => `File: ${b.path}\n\`\`\`${b.language}\n${b.content}\n\`\`\``).join('\n\n')}

Evaluate whether this output properly addresses all tasks. Respond with JSON only.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: EVALUATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      cwd: repoPath,
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    const parsed = JSON.parse(stripMarkdownFences(text)) as EvaluatorResult
    return {
      pass: Boolean(parsed.pass),
      feedback: parsed.feedback ?? '',
      summary: parsed.summary ?? '',
    }
  } catch {
    return {
      pass: false,
      feedback: 'Evaluator failed to produce valid JSON. Treating as failure — please retry.',
      summary: '',
    }
  }
}

// --- On-demand evaluation against actual repo state ---

const BATCH_REPO_EVALUATOR_SYSTEM_PROMPT = `You are the Quality Inspector for Shipyard.

You receive:
1. A list of tasks to evaluate
2. The actual repository code (not a builder's output)

Your job is to evaluate whether each task has been completed in the actual codebase. Check:
- Does the code fulfill the task requirement?
- Is the implementation complete (no stubs, TODOs, placeholders)?
- Is the code syntactically valid and would work if run?

${BATCH_REPO_EVALUATOR_FORMAT}`

/**
 * Evaluate tasks against the actual repository state in a single batched LLM call.
 * Sends all tasks + repo context once, gets back one JSON array with per-task results.
 */
export async function evaluateRepoState(params: {
  buildingId: BuildingId
  repoPath: string
  tasks: Task[]
  taskIds?: string[]
}): Promise<Array<{ taskId: string; pass: boolean; feedback: string; summary: string }>> {
  const { buildingId, repoPath, tasks, taskIds } = params

  // Filter to requested tasks, or all incomplete tasks
  const tasksToEval = taskIds
    ? tasks.filter((t) => taskIds.includes(t.id))
    : tasks.filter((t) => !t.done)

  if (tasksToEval.length === 0) return []

  const repoContext = await buildAgentContext(buildingId, repoPath)

  const taskList = tasksToEval
    .map((t) => `- ${t.label} (id: ${t.id})`)
    .join('\n')

  const userMessage = `## Building: ${buildingId}

## Tasks to evaluate (${tasksToEval.length}):
${taskList}

## Repository code:
${repoContext}

Evaluate whether each task has been completed in the actual codebase. Respond with a JSON array, one entry per task.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: BATCH_REPO_EVALUATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      cwd: repoPath,
    } as Anthropic.MessageCreateParamsNonStreaming)

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    const parsed = JSON.parse(stripMarkdownFences(text)) as Array<{
      id: string
      pass: boolean
      feedback: string
      summary: string
    }>

    // Map parsed results back to task IDs, falling back for any missing entries
    return tasksToEval.map((task) => {
      const match = parsed.find((r) => r.id === task.id)
      if (match) {
        return {
          taskId: task.id,
          pass: Boolean(match.pass),
          feedback: match.feedback ?? '',
          summary: match.summary ?? '',
        }
      }
      return { taskId: task.id, pass: false, feedback: 'Task not included in evaluator response.', summary: '' }
    })
  } catch {
    // If the single call fails, return all as failed rather than silently succeeding
    return tasksToEval.map((t) => ({
      taskId: t.id,
      pass: false,
      feedback: 'Evaluator failed to produce valid JSON. Please retry.',
      summary: '',
    }))
  }
}

/**
 * Compute a quick content hash of the repo context for a building.
 * Used to detect whether anything changed since the last evaluation.
 */
export async function computeRepoHash(buildingId: BuildingId, repoPath: string): Promise<string> {
  const context = await buildAgentContext(buildingId, repoPath)
  return crypto.createHash('sha256').update(context).digest('hex').slice(0, 16)
}

/**
 * Build a brief summary of evaluation results suitable for injecting
 * into the chat agent's conversation history.
 */
export function buildEvalSummary(
  results: Array<{ taskId: string; pass: boolean; feedback: string; summary: string }>,
  tasks: Task[]
): string {
  const lines: string[] = ['[Evaluation Results]']

  for (const r of results) {
    const task = tasks.find((t) => t.id === r.taskId)
    const label = task?.label ?? r.taskId
    if (r.pass) {
      lines.push(`✓ ${label}${r.summary ? ` — ${r.summary}` : ''}`)
    } else {
      lines.push(`✗ ${label} — ${r.feedback}`)
    }
  }

  const passed = results.filter((r) => r.pass).length
  lines.push(`\n${passed}/${results.length} tasks passing.`)

  return lines.join('\n')
}
