// server/src/routes/platform.ts
// POST /api/platform — stores the user's chosen deployment platform in the session.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { getSession, updateSession } from '../session/store'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  const { sessionId, platform } = req.body as {
    sessionId?: string
    platform?: string
  }

  if (!sessionId || !platform) {
    res.status(400).json({ error: 'sessionId and platform are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  updateSession(sessionId, { chosenPlatform: platform })
  res.json({ ok: true, platform })
})

export default router
