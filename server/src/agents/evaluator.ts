import { client } from './client'
import type { EvaluatorResult, Task } from '../types'

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
{ "pass": true, "feedback": "" }

If the code fails any check, set pass to false and explain what needs fixing in feedback:
{ "pass": false, "feedback": "The test file imports a module that doesn't exist. The health check route returns hardcoded values instead of real uptime." }`

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
    }
  } catch {
    return {
      pass: false,
      feedback: 'Evaluator failed to produce valid JSON. Treating as failure — please retry.',
    }
  }
}
