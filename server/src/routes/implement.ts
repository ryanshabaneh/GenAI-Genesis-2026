// server/src/routes/implement.ts
// POST /api/implement — runs aider on selected tasks for a specific building.
// The user picks which tasks to implement (by ID), optionally adds instructions,
// and gets back a preview of changed files + diff before accepting.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { BuildingId, Task } from '../types'
import { getSession } from '../session/store'
import { callAider, resetAiderChanges } from '../agents/aider'

const router = Router()

/**
 * Build a task-specific message for aider from the selected tasks
 * and optional user instructions.
 */
function buildTaskMessage(
  tasks: Task[],
  userMessage?: string
): string {
  const taskLines = tasks.map((t) => `- [ ] ${t.label}`).join('\n')

  let message = `The following tasks need to be implemented:\n\n${taskLines}\n\nPlease implement ALL of these tasks. Edit existing files or create new ones as needed.`

  if (userMessage) {
    message += `\n\nAdditional instructions from the user:\n${userMessage}`
  }

  return message
}

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

  // Look up the actual task labels from the session's scan results
  const buildingResult = session.results[buildingId]
  if (!buildingResult) {
    res.status(404).json({ error: `No scan results for building: ${buildingId}` })
    return
  }

  const selectedTasks = buildingResult.tasks.filter((t) => taskIds.includes(t.id))
  if (selectedTasks.length === 0) {
    res.status(400).json({ error: 'No matching tasks found for the given taskIds' })
    return
  }

  try {
    const taskDescription = buildTaskMessage(selectedTasks, message)

    const result = await callAider({
      buildingId,
      repoPath: session.repoPath,
      taskDescription,
    })

    if (!result.success) {
      res.status(500).json({ error: result.error ?? 'Aider failed to generate code' })
      // Clean up any partial changes
      await resetAiderChanges(session.repoPath)
      return
    }

    // Return the preview — frontend shows this before user accepts
    res.json({
      files: result.changedFiles.map((f) => ({
        path: f.path,
        content: f.content,
        isNew: true,
      })),
      diff: result.diff,
      taskIds: selectedTasks.map((t) => t.id),
    })

    // Reset repo after capturing the diff — accept route will store the files
    await resetAiderChanges(session.repoPath)
  } catch (err) {
    console.error('Implement error:', err)
    await resetAiderChanges(session.repoPath).catch(() => {})
    res.status(500).json({ error: 'Failed to implement tasks' })
  }
})

export default router
