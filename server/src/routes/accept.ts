// server/src/routes/accept.ts
// POST /api/accept — records accepted code changes for a session.
// Now accepts optional taskIds to mark specific tasks as done (from /api/implement).
// Falls back to marking the next incomplete task if taskIds not provided.
// Recalculates building percent based on actual task completion ratio.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type { BuildingId } from '../types'
import { getSession, updateSession } from '../session/store'
import { addChange } from '../changes/queue'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  const { sessionId, buildingId, files, taskIds } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    files?: { path: string; content: string; isNew: boolean }[]
    taskIds?: string[]
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

  // Update tasks and recalculate percent
  const current = session.results[buildingId]
  if (current) {
    const updatedTasks = current.tasks.map((t) => {
      if (taskIds && taskIds.length > 0) {
        // Mark specific tasks as done (from /api/implement flow)
        return taskIds.includes(t.id) ? { ...t, done: true } : t
      }
      return t
    })

    // If no taskIds provided, mark the next incomplete task (legacy behavior)
    if (!taskIds || taskIds.length === 0) {
      const firstIncomplete = updatedTasks.findIndex((t) => !t.done)
      if (firstIncomplete !== -1) {
        updatedTasks[firstIncomplete] = { ...updatedTasks[firstIncomplete], done: true }
      }
    }

    // Calculate percent from actual task completion ratio
    const doneCount = updatedTasks.filter((t) => t.done).length
    const totalCount = updatedTasks.length
    const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

    updateSession(sessionId, {
      results: {
        ...session.results,
        [buildingId]: { ...current, tasks: updatedTasks, percent },
      },
    })
  }

  // Re-fetch session for latest state
  const updated = getSession(sessionId)!
  const updatedResult = updated.results[buildingId]
  const allResults = Object.values(updated.results)
  const score =
    allResults.length > 0
      ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
      : 0

  res.json({
    buildingId,
    percent: updatedResult?.percent ?? 0,
    tasks: updatedResult?.tasks ?? [],
    score,
  })
})

export default router
