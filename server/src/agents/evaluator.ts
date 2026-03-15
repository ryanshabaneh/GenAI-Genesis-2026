import fs from 'fs'
import path from 'path'
import { client } from './client'
import { buildAgentContext } from './context'
import { EVALUATOR_FORMAT, REPO_EVALUATOR_FORMAT } from './prompts'
import type { BuildingId, EvaluatorResult, Task } from '../types'

/**
 * Deterministic checks for tasks that can be verified without an LLM.
 * Used to avoid false positives (e.g. LLM saying .env.example exists when repo is empty)
 * and to avoid path confusion when repoPath is wrong.
 */
function runDeterministicCheck(
  buildingId: string,
  taskId: string,
  repoPath: string
): { pass: boolean; feedback: string; summary: string } | null {
  if (buildingId === 'envVars' && taskId === 'env-example') {
    const hasEnvExample =
      fs.existsSync(path.join(repoPath, '.env.example')) ||
      fs.existsSync(path.join(repoPath, '.env.template'))
    return {
      pass: hasEnvExample,
      feedback: hasEnvExample ? '' : 'No .env.example or .env.template file found in the repository.',
      summary: hasEnvExample ? '.env.example or .env.template found in repository' : '',
    }
  }

  // .env in .gitignore — security (security-env-ignored) and envVars (env-gitignore)
  if (
    (buildingId === 'security' && taskId === 'security-env-ignored') ||
    (buildingId === 'envVars' && taskId === 'env-gitignore')
  ) {
    const gitignorePath = path.join(repoPath, '.gitignore')
    let envInGitignore = false
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8')
        envInGitignore = content.split('\n').some((line) => line.trim() === '.env')
      } catch {
        /* ignore */
      }
    }
    return {
      pass: envInGitignore,
      feedback: envInGitignore ? '' : 'No .gitignore found, or .env is not listed in .gitignore.',
      summary: envInGitignore ? '.env is listed in .gitignore' : '',
    }
  }

  return null
}

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

${EVALUATOR_FORMAT}`

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

${REPO_EVALUATOR_FORMAT}`

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
    const deterministic = runDeterministicCheck(buildingId, task.id, repoPath)
    if (deterministic !== null) {
      results.push({
        taskId: task.id,
        pass: deterministic.pass,
        feedback: deterministic.feedback,
        summary: deterministic.summary,
      })
      continue
    }

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
