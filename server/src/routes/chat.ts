// server/src/routes/chat.ts
// POST /api/chat — sends a user message to the specialist agent for a given building.
// Injects the building's current task list into the conversation so the agent
// can reference specific tasks when answering questions.
// This is the Q&A path — no code is written to disk. For implementation, use /api/implement.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId, Message } from '../types'
import { getSession } from '../session/store'
import { callAgent } from '../agents/base'

const router = Router()

/**
 * Build a task-context preamble so the agent knows what's done and what's not.
 */
function buildTaskContext(buildingId: BuildingId, session: ReturnType<typeof getSession>): string {
  if (!session) return ''

  const result = session.results[buildingId]
  if (!result || result.tasks.length === 0) return ''

  const lines = result.tasks.map((t) =>
    t.done ? `- [x] ${t.label}` : `- [ ] ${t.label}`
  )

  return `\n\nCurrent status for this building: ${result.percent}%\n\nTasks:\n${lines.join('\n')}\n\nThe user may ask about any of these tasks. Help them understand what needs to be done and how to approach it.`
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, message, history } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    message?: string
    history?: Message[]
  }

  if (!sessionId || !buildingId || !message) {
    res.status(400).json({ error: 'sessionId, buildingId, and message are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    // Append task context to the user's message so the agent is aware
    // of which tasks are done/incomplete without the frontend needing to send it
    const taskContext = buildTaskContext(buildingId, session)
    const enrichedMessage = taskContext
      ? `${message}\n\n---\n${taskContext}`
      : message

    const reply = await callAgent({
      buildingId,
      repoPath: session.repoPath,
      message: enrichedMessage,
      history: history ?? [],
    })

    res.json({ reply })
  } catch (err) {
    console.error('Agent error:', err)
    res.status(500).json({ error: 'Agent call failed' })
  }
})

export default router
