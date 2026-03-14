import { client } from './client'
import { buildAgentContext } from './context'
import type { BuildingId, EvaluatorResult, Task } from '../types'

const EVALUATOR_SYSTEM_PROMPT = `You are the Quality Inspector for ShipCity.

You receive:
1. A list of tasks the builder was asked to complete
2. The builder's response including code blocks

Your job is to evaluate whether the builder's output actually solves the tasks. Check:
- Are all incomplete tasks addressed by the code?
- Is the code syntactically valid (no obvious parse errors)?
- Does the code match the project stack (e.g. TypeScript for a TS project)?
- Are there any stubs, TODOs, placeholder comments, or "implement me" markers?
- Would the code actually work if applied to the project?

Respond with ONLY a JSON object — no markdown fences, no explanation:
{ "pass": true, "feedback": "", "summary": "Brief 1-2 sentence summary of what was accomplished" }

If the code fails any check, set pass to false and explain what needs fixing in feedback:
{ "pass": false, "feedback": "The test file imports a module that doesn't exist.", "summary": "Attempted to add unit tests but imports are broken" }`

export async function callEvaluator(params: {
  buildingId: string
  repoPath: string
  tasks: Task[]
  builderResponse: string
  codeBlocks: Array<{ path: string; content: string; language: string }>
}): Promise<EvaluatorResult> {
  const { buildingId, tasks, builderResponse, codeBlocks } = params

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
    })

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => ('text' in block ? block.text : ''))
      .join('')

    const parsed = JSON.parse(text) as EvaluatorResult
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

const REPO_EVALUATOR_SYSTEM_PROMPT = `You are the Quality Inspector for ShipCity.

You receive:
1. A task to evaluate
2. The actual repository code (not a builder's output)

Your job is to evaluate whether the task has been completed in the actual codebase. Check:
- Does the code fulfill the task requirement?
- Is the implementation complete (no stubs, TODOs, placeholders)?
- Is the code syntactically valid and would work if run?

Respond with ONLY a JSON object — no markdown fences, no explanation:
{ "pass": true, "feedback": "", "summary": "Brief 1-2 sentence summary of what exists in the repo" }

If the task is NOT fulfilled:
{ "pass": false, "feedback": "Explain what's missing or incomplete", "summary": "" }`

/**
 * Evaluate tasks against the actual repository state (not aider output).
 * Reads the repo files and checks each task individually.
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

  const results: Array<{ taskId: string; pass: boolean; feedback: string; summary: string }> = []

  for (const task of tasksToEval) {
    const userMessage = `## Building: ${buildingId}

## Task to evaluate:
- ${task.label} (id: ${task.id})

## Repository code:
${repoContext}

Evaluate whether this task has been completed in the actual codebase. Respond with JSON only.`

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: REPO_EVALUATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      })

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => ('text' in block ? block.text : ''))
        .join('')

      const parsed = JSON.parse(text) as EvaluatorResult
      results.push({
        taskId: task.id,
        pass: Boolean(parsed.pass),
        feedback: parsed.feedback ?? '',
        summary: parsed.summary ?? '',
      })
    } catch {
      results.push({
        taskId: task.id,
        pass: false,
        feedback: 'Evaluator failed to produce valid JSON for this task.',
        summary: '',
      })
    }
  }

  return results
}
