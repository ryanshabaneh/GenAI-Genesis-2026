// server/src/routes/chat.ts
// POST /api/chat — sends a user message to the specialist agent for a given building.
// Passes the scanner's AnalyzerResult into callAgent so the agent gets the full
// scanner preprompt (findings, task status, details) injected into its system context.
// This is the Q&A path — no code is written to disk. For implementation, use /api/implement.

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
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    const reply = await callAgent({
      buildingId,
      repoPath: session.repoPath,
      message,
      history: history ?? [],
      scanResult: session.results[buildingId],
    })

    res.json({ reply })
  } catch (err) {
    console.error('Agent error:', err)
    res.status(500).json({ error: 'Agent call failed' })
  }
})

export default router
