import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId, Task } from '../types'
import { getSession, updateSession } from '../session/store'

const router = Router()

router.put('/', (req: Request, res: Response): void => {
  const { sessionId, buildingId, percent, tasks } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    percent?: number
    tasks?: Task[]
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

  const current = session.results[buildingId]
  const updated = {
    buildingId,
    percent: percent != null ? Math.max(0, Math.min(percent, 100)) : (current?.percent ?? 0),
    tasks: tasks ?? current?.tasks ?? [],
    details: current?.details ?? {},
  }

  updateSession(sessionId, {
    results: { ...session.results, [buildingId]: updated },
  })

  const fresh = getSession(sessionId)!
  const allResults = Object.values(fresh.results)
  const score =
    allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + r.percent, 0) / allResults.length)
      : 0

  res.json({
    buildingId,
    percent: updated.percent,
    tasks: updated.tasks,
    score,
  })
})

export default router
