// server/src/routes/implement.ts
// POST /api/implement — runs aider + evaluator for selected tasks on a building.
// No longer returns a preview — runs the full loop, auto-accepts on pass.
// Progress streams via Socket.IO. HTTP response = final result.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import type { BuildingId } from '../types'
import { getSession } from '../session/store'
import { runTaskImplementation } from '../orchestrator'
import { calculatePercent } from '../agents/scanner-context'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, taskIds, message } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    taskIds?: string[]
    message?: string
  }

  if (!sessionId || !buildingId || !Array.isArray(taskIds) || taskIds.length === 0) {
    res.status(400).json({ error: 'sessionId, buildingId, and taskIds are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (!session.repoPath) {
    res.status(409).json({ error: 'Scan is still in progress — please wait for it to finish.' })
    return
  }

  const buildingResult = session.results[buildingId]
  if (!buildingResult) {
    res.status(404).json({ error: `No scan results for building: ${buildingId}` })
    return
  }

  const io = req.app.locals['io'] as SocketIOServer

  try {
    const result = await runTaskImplementation({
      sessionId,
      buildingId,
      taskIds,
      userMessage: message,
      io,
    })

    // Re-fetch session for latest state
    const updated = getSession(sessionId)!
    const updatedResult = updated.results[buildingId]
    const allResults = Object.values(updated.results)
    const score =
      allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
        : 0

    res.json({
      success: result.success,
      completedTaskIds: result.completedTaskIds,
      percent: updatedResult?.percent ?? 0,
      score,
    })
  } catch (err) {
    console.error('Implement error:', err)
    const message = err instanceof Error ? err.message : 'Failed to implement tasks'
    res.status(500).json({ error: message })
  }
})

export default router
