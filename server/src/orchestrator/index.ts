// server/src/orchestrator/index.ts
// User-driven task implementation: agent (brain) generates code, aider (hands)
// applies it. If aider isn't installed, the agent generates code blocks directly.
// Progress streams via Socket.IO. Session-level mutex prevents concurrent runs.

import type { Server as SocketIOServer } from 'socket.io'
import { v4 as uuid } from 'uuid'
import { getSession, updateSession } from '../session/store'
import { callAider, resetAiderChanges } from '../agents/aider'
import { callAgent, callAgentForImplementation, parseCodeBlocks } from '../agents/base'
import { callEvaluator } from '../agents/evaluator'
import { buildChangeLogContext, calculatePercent } from '../agents/scanner-context'
import { addChange } from '../changes/queue'
import type { BuildingId, ChangeLogEntry } from '../types'

const MAX_ITERATIONS = 3

// Session-level mutex: prevents concurrent runs on the same repo
const activeSessions = new Set<string>()

// Check if aider is available on this system
let aiderAvailable: boolean | null = null
/** Reset the aider cache (for testing) */
export function _resetAiderCheck() { aiderAvailable = null }
/** Force aider availability (for testing) */
export function _setAiderAvailable(val: boolean) { aiderAvailable = val }
async function checkAider(): Promise<boolean> {
  if (aiderAvailable !== null) return aiderAvailable
  try {
    const { execSync } = await import('child_process')
    execSync('aider --version', { timeout: 5000, stdio: 'pipe' })
    aiderAvailable = true
    console.log('[orchestrator] aider found — using agent→aider pipeline')
  } catch {
    aiderAvailable = false
    console.log('[orchestrator] aider not found — using agent-only pipeline (code blocks)')
  }
  return aiderAvailable
}

/**
 * Run implementation loop for selected tasks on a building.
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

  if (session.pendingReview) {
    throw new Error('A pending review must be accepted or rejected before running another implementation')
  }

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

    const changeLogContext = buildChangeLogContext(session, buildingId)
    const conversationHistory = session.conversations[buildingId] ?? []

    const taskLines = selectedTasks.map((t) => `- [ ] ${t.label}`).join('\n')
    let taskMessage = `Please implement ALL of these tasks:\n\n${taskLines}\n\nEdit existing files or create new ones as needed.`
    if (userMessage) {
      taskMessage += `\n\nAdditional instructions from the user:\n${userMessage}`
    }

    // Emit task:start
    for (const task of selectedTasks) {
      io.to(sessionId).emit('message', {
        type: 'task:start',
        building: buildingId,
        taskId: task.id,
        taskLabel: task.label,
      })
      console.log(`[orchestrator] task:start ${buildingId}/${task.id}: ${task.label}`)
    }

    const hasAider = await checkAider()

    if (hasAider) {
      await runWithAider({ sessionId, buildingId, taskIds, selectedTasks, taskMessage, conversationHistory, buildingResult, changeLogContext, io, session })
    } else {
      await runAgentOnly({ sessionId, buildingId, taskIds, selectedTasks, taskMessage, conversationHistory, buildingResult, changeLogContext, io, session })
    }

    // Check what was completed
    const freshSession = getSession(sessionId)!
    const updatedResult = freshSession.results[buildingId]
    if (updatedResult) {
      for (const task of selectedTasks) {
        const t = updatedResult.tasks.find((x) => x.id === task.id)
        if (t?.done) completedTaskIds.push(task.id)
      }
    }

    // Emit failure for tasks not completed
    for (const task of selectedTasks) {
      if (!completedTaskIds.includes(task.id)) {
        io.to(sessionId).emit('message', {
          type: 'task:complete',
          building: buildingId,
          taskId: task.id,
          success: false,
          summary: 'Implementation did not pass evaluation',
        })
        console.log(`[orchestrator] task:complete (FAILED) ${buildingId}/${task.id}`)
      }
    }
  } finally {
    activeSessions.delete(sessionId)
  }

  return { success: completedTaskIds.length > 0, completedTaskIds }
}

// ── Agent + Aider pipeline ──────────────────────────────────────────

async function runWithAider(ctx: ImplementContext) {
  const { sessionId, buildingId, taskIds, selectedTasks, taskMessage, conversationHistory, buildingResult, changeLogContext, io, session } = ctx

  console.log(`[orchestrator] using agent→aider pipeline for ${buildingId}`)

  let agentInstructions = await callAgentForImplementation({
    buildingId,
    repoPath: session.repoPath,
    message: taskMessage,
    history: conversationHistory,
    scanResult: buildingResult,
    changeLogContext,
  })
  console.log(`[orchestrator] agent produced ${agentInstructions.length} chars of instructions`)

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`[orchestrator] aider iteration ${iteration}/${MAX_ITERATIONS}`)

    const aiderResult = await callAider({
      buildingId,
      repoPath: session.repoPath,
      taskDescription: agentInstructions,
    })

    if (!aiderResult.success || aiderResult.changedFiles.length === 0) {
      console.log(`[orchestrator] aider produced no changes: ${aiderResult.error ?? 'unknown'}`)
      if (iteration === MAX_ITERATIONS) break
      continue
    }

    console.log(`[orchestrator] aider changed ${aiderResult.changedFiles.length} files, evaluating...`)

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
      console.log(`[orchestrator] eval ${evalResult.pass ? 'PASSED' : 'auto-accepted (max iterations)'}`)
      // Leave aider's changes on disk for user review instead of resetting
      const filesList = aiderResult.changedFiles.map((f) => f.path)
      updateSession(sessionId, {
        pendingReview: {
          buildingId,
          taskIds,
          files: filesList,
          summary: evalResult.summary,
          createdAt: Date.now(),
        },
      })
      io.to(sessionId).emit('message', {
        type: 'review:pending',
        building: buildingId,
        files: filesList,
        summary: evalResult.summary,
      })
      break
    }

    console.log(`[orchestrator] eval FAILED: ${evalResult.feedback.slice(0, 200)}`)
    await resetAiderChanges(session.repoPath)

    agentInstructions = await callAgentForImplementation({
      buildingId,
      repoPath: session.repoPath,
      message: `The quality evaluator rejected the previous attempt.\n\nFeedback:\n${evalResult.feedback}\n\nPlease provide refined instructions.`,
      history: [
        ...conversationHistory,
        { role: 'user' as const, content: taskMessage },
        { role: 'assistant' as const, content: agentInstructions },
      ],
      scanResult: buildingResult,
      changeLogContext,
    })
  }
}

// ── Agent-only pipeline (no aider) ──────────────────────────────────

async function runAgentOnly(ctx: ImplementContext) {
  const { sessionId, buildingId, taskIds, selectedTasks, taskMessage, conversationHistory, buildingResult, changeLogContext, io, session } = ctx

  console.log(`[orchestrator] using agent-only pipeline for ${buildingId} (no aider)`)

  // Ask the agent to generate code directly (chat mode, which produces code blocks)
  const reply = await callAgent({
    buildingId,
    repoPath: session.repoPath,
    message: taskMessage,
    history: conversationHistory,
    scanResult: buildingResult,
    changeLogContext,
  })

  console.log(`[orchestrator] agent response: ${reply.content.length} chars, ${reply.codeBlocks?.length ?? 0} code blocks`)

  const codeBlocks = reply.codeBlocks ?? parseCodeBlocks(reply.content)

  if (codeBlocks.length === 0) {
    console.log(`[orchestrator] agent produced no code blocks — treating as advice-only`)
    // Still save the agent's response as a chat message so the user can see it
    const freshSession = getSession(sessionId)!
    updateSession(sessionId, {
      conversations: {
        ...freshSession.conversations,
        [buildingId]: [
          ...(freshSession.conversations[buildingId] ?? []),
          { role: 'user' as const, content: taskMessage },
          { role: 'assistant' as const, content: reply.content },
        ],
      },
    })
    return
  }

  // Convert code blocks to file changes
  const changedFiles = codeBlocks
    .filter((b) => b.path !== 'snippet') // skip unnamed snippets
    .map((b) => ({ path: b.path, content: b.content }))

  console.log(`[orchestrator] accepting ${changedFiles.length} files from agent`)

  if (changedFiles.length > 0) {
    acceptChanges(ctx, changedFiles, `Agent generated ${changedFiles.length} files for ${buildingId}`)
  }
}

// ── Shared: accept changes + update session ─────────────────────────

function acceptChanges(
  ctx: ImplementContext,
  changedFiles: Array<{ path: string; content: string }>,
  summary: string
) {
  const { sessionId, buildingId, taskIds, selectedTasks, io } = ctx

  addChange(sessionId, {
    id: uuid(),
    buildingId,
    files: changedFiles.map((f) => ({ path: f.path, content: f.content, isNew: true })),
    acceptedAt: Date.now(),
  })

  const freshSession = getSession(sessionId)!
  const current = freshSession.results[buildingId]!
  const updatedTasks = current.tasks.map((t) =>
    taskIds.includes(t.id) ? { ...t, done: true } : t
  )

  const newLogEntries: ChangeLogEntry[] = selectedTasks.map((t) => ({
    taskId: t.id,
    taskLabel: t.label,
    buildingId,
    summary: summary || `Implemented ${t.label}`,
    filesChanged: changedFiles.map((f) => f.path),
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

  for (const task of selectedTasks) {
    io.to(sessionId).emit('message', {
      type: 'task:complete',
      building: buildingId,
      taskId: task.id,
      success: true,
      summary: summary || `Implemented ${task.label}`,
    })
    console.log(`[orchestrator] task:complete (OK) ${buildingId}/${task.id}`)
  }
}

// ── Types ───────────────────────────────────────────────────────────

interface ImplementContext {
  sessionId: string
  buildingId: BuildingId
  taskIds: string[]
  selectedTasks: Array<{ id: string; label: string; done: boolean }>
  taskMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  buildingResult: import('../types').AnalyzerResult
  changeLogContext: string
  io: SocketIOServer
  session: import('../types').Session
}
