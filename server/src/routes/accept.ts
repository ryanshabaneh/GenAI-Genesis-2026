// server/src/routes/accept.ts
// POST /api/accept — records accepted code changes for a session.
// Now accepts optional taskIds to mark specific tasks as done (from /api/implement).
// Falls back to marking the next incomplete task if taskIds not provided.
// Recalculates building percent based on actual task completion ratio.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { BuildingId, ChangeLogEntry, Message } from '../types'
import { getSession, updateSession } from '../session/store'
import { addChange } from '../changes/queue'
import { calculatePercent, formatDeploymentRecommendation } from '../agents/scanner-context'
import { resetAiderChanges } from '../agents/aider'

const execFileAsync = promisify(execFile)
const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, files, taskIds } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    files?: { path: string; content: string; isNew: boolean }[]
    taskIds?: string[]
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

  // ── Pending-review path: aider changes are on disk, commit them ──
  if (session.pendingReview && session.pendingReview.buildingId === buildingId) {
    const pr = session.pendingReview

    try {
      // Commit aider's on-disk changes
      await execFileAsync('git', ['add', '-A'], { cwd: session.repoPath })
      const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: session.repoPath })
      if (status.trim()) {
        await execFileAsync('git', ['commit', '-m', `feat(${buildingId}): ${pr.summary}`], { cwd: session.repoPath })
      }
    } catch (err) {
      console.error('[accept] git commit failed:', err)
      // Even if commit fails, continue with in-memory bookkeeping
    }

    // Read file contents from disk for the changes queue (zip export)
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    const fileContents: Array<{ path: string; content: string; isNew: boolean }> = []
    for (const filePath of pr.files) {
      try {
        const content = await readFile(join(session.repoPath, filePath), 'utf8')
        fileContents.push({ path: filePath, content, isNew: true })
      } catch {
        // file may have been deleted
      }
    }

    addChange(sessionId, {
      id: uuidv4(),
      buildingId,
      files: fileContents,
      acceptedAt: Date.now(),
    })

    // Mark tasks done and recalculate percent
    const current = session.results[buildingId]
    if (current) {
      const updatedTasks = current.tasks.map((t) =>
        pr.taskIds.includes(t.id) ? { ...t, done: true } : t
      )
      const percent = calculatePercent(updatedTasks)

      const newLogEntries: ChangeLogEntry[] = current.tasks
        .filter((t) => pr.taskIds.includes(t.id))
        .map((t) => ({
          taskId: t.id,
          taskLabel: t.label,
          buildingId,
          summary: pr.summary || `Implemented ${t.label}`,
          filesChanged: pr.files,
          completedAt: Date.now(),
        }))

      updateSession(sessionId, {
        results: {
          ...session.results,
          [buildingId]: { ...current, tasks: updatedTasks, percent },
        },
        changeLog: [...session.changeLog, ...newLogEntries],
        pendingReview: null,
      })
    } else {
      updateSession(sessionId, { pendingReview: null })
    }

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
    return
  }

  // ── Chat code-block path: write files to the cloned repo, then record ──
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'files are required when no pending review exists' })
    return
  }

  // Write accepted code blocks to disk so the agent sees them in follow-up context
  console.log('[accept] repoPath:', session.repoPath)
  console.log('[accept] files to write:', files.map(f => f.path))
  if (session.repoPath) {
    const { writeFile, mkdir } = await import('fs/promises')
    const { join, dirname } = await import('path')
    for (const file of files) {
      const fullPath = join(session.repoPath, file.path)
      console.log('[accept] writing file:', fullPath, `(${file.content.length} bytes)`)
      await mkdir(dirname(fullPath), { recursive: true })
      await writeFile(fullPath, file.content, 'utf8')
    }
    try {
      await execFileAsync('git', ['add', '-A'], { cwd: session.repoPath })
      const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: session.repoPath })
      console.log('[accept] git status after write:', status || '(empty — no changes)')
      if (status.trim()) {
        await execFileAsync('git', ['commit', '-m', `feat(${buildingId}): apply chat suggestions`], { cwd: session.repoPath })
        console.log('[accept] committed successfully')
      } else {
        console.warn('[accept] nothing to commit — files may be identical to what is already on disk')
      }
    } catch (err) {
      console.error('[accept] git commit failed:', err)
    }
  } else {
    console.error('[accept] NO repoPath — files were NOT written to disk!')
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

    const percent = calculatePercent(updatedTasks)

    const sessionUpdate: Record<string, unknown> = {
      results: {
        ...session.results,
        [buildingId]: { ...current, tasks: updatedTasks, percent },
      },
    }

    // If deployment just hit 100%, inject deployment recommendation into chat
    if (buildingId === 'deployment' && percent === 100 && session.deploymentRecommendation) {
      const chatHistory: Message[] = session.conversations[buildingId] ?? []
      const recMessage = formatDeploymentRecommendation(session.deploymentRecommendation)
      sessionUpdate['conversations'] = {
        ...session.conversations,
        [buildingId]: [...chatHistory, { role: 'assistant', content: recMessage }],
      }
    }

    updateSession(sessionId, sessionUpdate)
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
