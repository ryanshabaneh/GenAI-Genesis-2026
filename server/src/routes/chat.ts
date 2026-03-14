// server/src/routes/chat.ts
// POST /api/chat — sends a user message to the specialist agent for a given building.
// Validates that the session exists (so the agent can read the repo files),
// then delegates to callAgent which builds context from the cloned repo and
// calls the Claude API. Returns the agent's reply with any parsed code blocks.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId, Message } from '../types'
import { getSession } from '../session/store'
import { callAgent } from '../agents/base'

const router = Router()

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
    // Session not found usually means the server restarted and lost in-memory state
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const reply = await callAgent({
      buildingId,
      repoPath: session.repoPath, // Agent needs this to read source files for context
      message,
      history: history ?? [],
    })

    res.json({ reply })
  } catch (err) {
    console.error('Agent error:', err)
    res.status(500).json({ error: 'Agent call failed' })
  }
})

export default router
