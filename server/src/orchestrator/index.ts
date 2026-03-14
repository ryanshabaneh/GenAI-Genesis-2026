// server/src/orchestrator/index.ts
// User-driven task implementation: runs aider + evaluator for selected tasks
// on a specific building. Progress streams via Socket.IO. A session-level mutex
// prevents concurrent aider runs on the same repo.

import type { Server as SocketIOServer } from 'socket.io'
import { v4 as uuid } from 'uuid'
import { getSession, updateSession } from '../session/store'
import { callAider, resetAiderChanges } from '../agents/aider'
import { callAgentForImplementation } from '../agents/base'
import { callEvaluator } from '../agents/evaluator'
import { buildChangeLogContext, calculatePercent } from '../agents/scanner-context'
import { addChange } from '../changes/queue'
import type { BuildingId, ChangeLogEntry } from '../types'

const MAX_ITERATIONS = 3

// Session-level mutex: prevents two buildings from running aider simultaneously
const activeSessions = new Set<string>()

/**
 * Run aider + evaluator loop for selected tasks on a building.
 * Called by /api/implement. Emits task:start and task:complete events.
 */
export async function runTaskImplementation(params: {
  sessionId: string
  buildingId: BuildingId
  taskIds: string[]
  userMessage?: string
  io: SocketIOServer
}): Promise<{ success: boolean; completedTaskIds: string[] }> {
  const { sessionId, buildingId, taskIds, userMessage, io } = params

  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found')

  // Concurrency guard
  if (activeSessions.has(sessionId)) {
    throw new Error('Another implementation is already running for this session')
  }
  activeSessions.add(sessionId)

  const completedTaskIds: string[] = []

  try {
    const buildingResult = session.results[buildingId]
    if (!buildingResult) throw new Error(`No scan results for building: ${buildingId}`)

    const selectedTasks = buildingResult.tasks.filter((t) => taskIds.includes(t.id))
    if (selectedTasks.length === 0) throw new Error('No matching tasks found')

    // Build context
    const changeLogContext = buildChangeLogContext(session, buildingId)
    const conversationHistory = session.conversations[buildingId] ?? []

    const taskLines = selectedTasks.map((t) => `- [ ] ${t.label}`).join('\n')
    let taskMessage = `Please implement ALL of these tasks:\n\n${taskLines}\n\nEdit existing files or create new ones as needed.`
    if (userMessage) {
      taskMessage += `\n\nAdditional instructions from the user:\n${userMessage}`
    }

    // Emit task:start for each task
    for (const task of selectedTasks) {
      io.to(sessionId).emit('message', {
        type: 'task:start',
        building: buildingId,
        taskId: task.id,
        taskLabel: task.label,
      })
    }

    // Ask the agent (brain) to produce specific implementation instructions
    let agentInstructions = await callAgentForImplementation({
      buildingId,
      repoPath: session.repoPath,
      message: taskMessage,
      history: conversationHistory,
      scanResult: buildingResult,
      changeLogContext,
    })

    let lastFeedback: string | undefined

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const aiderResult = await callAider({
        buildingId,
        repoPath: session.repoPath,
        taskDescription: agentInstructions,
      })

      if (!aiderResult.success || aiderResult.changedFiles.length === 0) {
        if (iteration === MAX_ITERATIONS) break
        lastFeedback = aiderResult.error ?? 'No changes were produced. Please try again.'
        continue
      }

      // Evaluate
      const evalResult = await callEvaluator({
        buildingId,
        repoPath: session.repoPath,
        tasks: selectedTasks,
        builderResponse: aiderResult.diff,
        codeBlocks: aiderResult.changedFiles.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.path.split('.').pop() ?? 'text',
        })),
      })

      if (evalResult.pass || iteration === MAX_ITERATIONS) {
        // Accept: save changed files
        addChange(sessionId, {
          id: uuid(),
          buildingId,
          files: aiderResult.changedFiles.map((f) => ({
            path: f.path,
            content: f.content,
            isNew: true,
          })),
          acceptedAt: Date.now(),
        })

        // Mark tasks done and create change log entries
        const freshSession = getSession(sessionId)!
        const current = freshSession.results[buildingId]!
        const updatedTasks = current.tasks.map((t) =>
          taskIds.includes(t.id) ? { ...t, done: true } : t
        )

        const newLogEntries: ChangeLogEntry[] = selectedTasks.map((t) => ({
          taskId: t.id,
          taskLabel: t.label,
          buildingId,
          summary: evalResult.summary || `Implemented ${t.label}`,
          filesChanged: aiderResult.changedFiles.map((f) => f.path),
          completedAt: Date.now(),
        }))

        updateSession(sessionId, {
          results: {
            ...freshSession.results,
            [buildingId]: {
              ...current,
              percent: calculatePercent(updatedTasks),
              tasks: updatedTasks,
            },
          },
          changeLog: [...freshSession.changeLog, ...newLogEntries],
        })

        completedTaskIds.push(...selectedTasks.map((t) => t.id))

        // Emit task:complete for each task
        for (const task of selectedTasks) {
          io.to(sessionId).emit('message', {
            type: 'task:complete',
            building: buildingId,
            taskId: task.id,
            success: true,
            summary: evalResult.summary || `Implemented ${task.label}`,
          })
        }

        await resetAiderChanges(session.repoPath)
        break
      }

      // Evaluation failed — ask the agent to refine instructions based on feedback
      lastFeedback = evalResult.feedback
      await resetAiderChanges(session.repoPath)

      agentInstructions = await callAgentForImplementation({
        buildingId,
        repoPath: session.repoPath,
        message: `The quality evaluator rejected the previous implementation attempt.\n\nEvaluator feedback:\n${lastFeedback}\n\nPlease provide refined implementation instructions that address these issues.`,
        history: [
          ...conversationHistory,
          { role: 'user' as const, content: taskMessage },
          { role: 'assistant' as const, content: agentInstructions },
        ],
        scanResult: buildingResult,
        changeLogContext,
      })
    }

    // If nothing was completed, emit failure
    if (completedTaskIds.length === 0) {
      await resetAiderChanges(session.repoPath).catch(() => {})
      for (const task of selectedTasks) {
        io.to(sessionId).emit('message', {
          type: 'task:complete',
          building: buildingId,
          taskId: task.id,
          success: false,
          summary: 'Max iterations reached without passing evaluation',
        })
      }
    }
  } finally {
    activeSessions.delete(sessionId)
  }

  return { success: completedTaskIds.length > 0, completedTaskIds }
}
