// server/src/routes/accept.ts
// POST /api/accept — records accepted code changes for a session.
// Appends files to the changes queue, bumps the building percent by 25 (capped at 100),
// marks the next incomplete task as done, and returns the updated building state + score.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { BuildingId } from '../types'
import { getSession, updateSession } from '../session/store'
import { addChange } from '../changes/queue'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  const { sessionId, buildingId, files } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    files?: { path: string; content: string; isNew: boolean }[]
  }

  if (!sessionId || !buildingId || !Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'sessionId, buildingId, and files are required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  // Append to the changes queue
  addChange(sessionId, {
    id: uuidv4(),
    buildingId,
    files,
    acceptedAt: Date.now(),
  })

  // Update building percent (+25, capped at 100) and mark next task done
  const current = session.results[buildingId]
  const updatedResult = current
    ? {
        ...current,
        percent: Math.min(current.percent + 25, 100),
        tasks: current.tasks.map((t, i) => {
          // Mark only the first incomplete task as done
          const firstIncompleteIndex = current.tasks.findIndex((x) => !x.done)
          return i === firstIncompleteIndex ? { ...t, done: true } : t
        }),
      }
    : undefined

  if (updatedResult) {
    updateSession(sessionId, {
      results: { ...session.results, [buildingId]: updatedResult },
    })
  }

  // Re-fetch session for latest state
  const updated = getSession(sessionId)!
  const allResults = Object.values(updated.results)
  const score =
    allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + r.percent, 0) / allResults.length)
      : 0

  res.json({
    buildingId,
    percent: updatedResult?.percent ?? 0,
    tasks: updatedResult?.tasks ?? [],
    score,
  })
})

export default router
