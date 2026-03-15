// server/src/routes/evaluate.ts
// POST /api/evaluate — on-demand evaluation of tasks against actual repo state.
// Checks which tasks are fulfilled in the current codebase, marks passing tasks
// done, creates change log entries, and returns per-task results with feedback.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import type { BuildingId, ChangeLogEntry, Message } from '../types'
import { getSession, updateSession } from '../session/store'
import { evaluateRepoState, computeRepoHash, buildEvalSummary } from '../agents/evaluator'
import { calculatePercent } from '../agents/scanner-context'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, taskIds } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
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
    // Check if repo changed since last evaluation — skip if identical
    const currentHash = await computeRepoHash(buildingId, session.repoPath)
    const lastHash = session.lastEvalHash?.[buildingId]
    if (lastHash === currentHash) {
      // Nothing changed — return cached task state without re-evaluating
      const percent = calculatePercent(buildingResult.tasks)
      const allResults = Object.values(session.results)
      const score = allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
        : 0
      res.json({
        results: [],
        tasks: buildingResult.tasks,
        percent,
        score,
        skipped: true,
        message: 'No changes detected since last evaluation.',
      })
      return
    }

    const evalResults = await evaluateRepoState({
      buildingId,
      repoPath: session.repoPath,
      tasks: buildingResult.tasks,
      taskIds,
    })

    // Update tasks and create change log entries for passing tasks
    const freshSession = getSession(sessionId)!
    const current = freshSession.results[buildingId]!
    const newLogEntries: ChangeLogEntry[] = []

    const updatedTasks = current.tasks.map((t) => {
      const evalResult = evalResults.find((r) => r.taskId === t.id)
      if (evalResult?.pass) {
        newLogEntries.push({
          taskId: t.id,
          taskLabel: t.label,
          buildingId,
          summary: evalResult.summary || `${t.label} verified in repo`,
          filesChanged: [],
          completedAt: Date.now(),
        })
        return { ...t, done: true, feedback: undefined }
      }
      if (evalResult && !evalResult.pass) {
        return { ...t, feedback: evalResult.feedback }
      }
      return t
    })

    const percent = calculatePercent(updatedTasks)

    // Inject evaluation summary into the chat history so the chat agent has context
    const evalSummaryText = buildEvalSummary(evalResults, buildingResult.tasks)
    const chatHistory: Message[] = freshSession.conversations[buildingId] ?? []
    const updatedHistory: Message[] = [
      ...chatHistory,
      { role: 'assistant', content: evalSummaryText },
    ]

    updateSession(sessionId, {
      results: {
        ...freshSession.results,
        [buildingId]: { ...current, tasks: updatedTasks, percent },
      },
      changeLog: [...freshSession.changeLog, ...newLogEntries],
      conversations: {
        ...freshSession.conversations,
        [buildingId]: updatedHistory,
      },
      lastEvalHash: {
        ...freshSession.lastEvalHash,
        [buildingId]: currentHash,
      },
    })

    // Emit eval:result per task
    for (const result of evalResults) {
      io.to(sessionId).emit('message', {
        type: 'eval:result',
        building: buildingId,
        taskId: result.taskId,
        pass: result.pass,
        feedback: result.feedback,
      })
    }

    // Calculate overall score
    const updated = getSession(sessionId)!
    const allResults = Object.values(updated.results)
    const score =
      allResults.length > 0
        ? Math.round(allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length)
        : 0

    res.json({
      results: evalResults.map((r) =>
        r.pass
          ? { taskId: r.taskId, pass: true, summary: r.summary }
          : { taskId: r.taskId, pass: false, feedback: r.feedback }
      ),
      tasks: updatedTasks,
      percent,
      score,
    })
  } catch (err) {
    console.error('Evaluate error:', err)
    res.status(500).json({ error: 'Evaluation failed' })
  }
})

export default router
