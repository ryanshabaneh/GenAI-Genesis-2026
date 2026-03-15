// server/src/routes/reject.ts
// POST /api/reject — rejects pending aider changes, resetting the repo to clean state.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId } from '../types'
import { getSession, updateSession } from '../session/store'
import { resetAiderChanges } from '../agents/aider'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
  }

  if (!sessionId || !buildingId) {
    res.status(400).json({ error: 'sessionId and buildingId are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (!session.pendingReview || session.pendingReview.buildingId !== buildingId) {
    res.status(400).json({ error: 'No pending review for this building' })
    return
  }

  // Wipe aider's disk changes
  await resetAiderChanges(session.repoPath)

  // Clear pending review from session
  updateSession(sessionId, { pendingReview: null })

  res.json({ success: true })
})

export default router
