// server/src/orchestrator/index.ts
// Autonomous orchestrator: after a scan completes, iterates over every building
// below 100% and uses aider (via CLI) + evaluator subagent to fix issues.
// Aider handles repo mapping (tree-sitter) and file editing directly on disk.
// The evaluator gates quality — if aider's output fails evaluation,
// feedback is fed back for up to MAX_ITERATIONS attempts.
// After accepting code, the session's results are updated (percent bumped,
// tasks marked done) so the final score reflects actual fixes.

import type { Server as SocketIOServer } from 'socket.io'
import { v4 as uuid } from 'uuid'
import { getSession, updateSession } from '../session/store'
import { callAider, resetAiderChanges } from '../agents/aider'
import { callEvaluator } from '../agents/evaluator'
import { buildScannerPreprompt, calculatePercent } from '../agents/scanner-context'
import { addChange } from '../changes/queue'
import type { AnalyzerResult, BuildingId } from '../types'

const MAX_ITERATIONS = 3

/**
 * Build the task description from analyzer results so aider knows
 * exactly which tasks to fix.
 */
function craftTaskDescription(result: AnalyzerResult): string {
  const scannerPreprompt = buildScannerPreprompt(result)
  const incomplete = result.tasks.filter((t) => !t.done)
  const lines = incomplete.map((t) => `- [ ] ${t.label}`)

  return `${scannerPreprompt}\n\n---\n\nPlease implement ALL of these incomplete tasks:\n\n${lines.join('\n')}\n\nEdit existing files or create new ones as needed.`
}

/**
 * After auto-accepting code for a building, mark incomplete tasks as done
 * and recalculate percent from the actual task completion ratio.
 */
function markBuildingFixed(sessionId: string, buildingId: BuildingId): void {
  const session = getSession(sessionId)
  if (!session) return

  const current = session.results[buildingId]
  if (!current) return

  const updatedTasks = current.tasks.map((t) => ({ ...t, done: true }))

  updateSession(sessionId, {
    results: {
      ...session.results,
      [buildingId]: {
        ...current,
        percent: calculatePercent(updatedTasks),
        tasks: updatedTasks,
      },
    },
  })
}

/**
 * Main orchestrator loop — called after runScan completes.
 * Processes buildings sequentially; each building gets up to MAX_ITERATIONS
 * of aider→evaluator feedback before auto-accepting.
 */
export async function runOrchestrator(
  sessionId: string,
  io: SocketIOServer
): Promise<void> {
  const session = getSession(sessionId)
  if (!session) return

  const results = session.results
  const buildingsToFix = Object.values(results).filter(
    (r): r is AnalyzerResult => r !== undefined && r.percent < 100
  )

  if (buildingsToFix.length === 0) {
    io.to(sessionId).emit('message', { type: 'orchestrator:complete', score: 100 })
    return
  }

  for (const result of buildingsToFix) {
    const building = result.buildingId

    try {
      io.to(sessionId).emit('message', { type: 'agent:start', building })

      const taskDescription = craftTaskDescription(result)
      let accepted = false
      let lastFeedback: string | undefined

      for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
        // Call aider — it reads the repo via tree-sitter map and edits files on disk
        const aiderResult = await callAider({
          buildingId: building,
          repoPath: session.repoPath,
          taskDescription,
          feedback: lastFeedback,
        })

        if (!aiderResult.success || aiderResult.changedFiles.length === 0) {
          // Aider failed or made no changes — skip evaluator
          if (iteration === MAX_ITERATIONS) break
          lastFeedback = aiderResult.error ?? 'No changes were produced. Please try again.'
          continue
        }

        // Call the evaluator on what aider actually wrote
        const evalResult = await callEvaluator({
          buildingId: building,
          repoPath: session.repoPath,
          tasks: result.tasks,
          builderResponse: aiderResult.diff,
          codeBlocks: aiderResult.changedFiles.map((f) => ({
            path: f.path,
            content: f.content,
            language: f.path.split('.').pop() ?? 'text',
          })),
        })

        if (evalResult.pass || iteration === MAX_ITERATIONS) {
          // Accept: save changed files as an AcceptedChange
          addChange(sessionId, {
            id: uuid(),
            buildingId: building,
            files: aiderResult.changedFiles.map((f) => ({
              path: f.path,
              content: f.content,
              isNew: true,
            })),
            acceptedAt: Date.now(),
          })

          markBuildingFixed(sessionId, building)

          io.to(sessionId).emit('message', {
            type: 'agent:complete',
            building,
            percent: 100,
            files: aiderResult.changedFiles.map((f) => f.path),
          })

          accepted = true
          // Reset repo for next building
          await resetAiderChanges(session.repoPath)
          break
        }

        // Evaluation failed — reset files and retry with feedback
        io.to(sessionId).emit('message', {
          type: 'agent:iteration',
          building,
          iteration,
          maxIterations: MAX_ITERATIONS,
          feedback: evalResult.feedback,
        })

        lastFeedback = evalResult.feedback

        // Reset aider's changes so the next iteration starts clean
        await resetAiderChanges(session.repoPath)
      }

      if (!accepted) {
        // Clean up any leftover changes
        await resetAiderChanges(session.repoPath)

        io.to(sessionId).emit('message', {
          type: 'agent:error',
          building,
          error: 'Max iterations reached without passing evaluation',
        })
      }
    } catch (err) {
      console.error(`Orchestrator error for ${building}:`, err)
      // Clean up on error
      await resetAiderChanges(session.repoPath).catch(() => {})

      io.to(sessionId).emit('message', {
        type: 'agent:error',
        building,
        error: err instanceof Error ? err.message : 'Unknown agent error',
      })
    }
  }

  // Calculate final score from updated session state
  const updatedSession = getSession(sessionId)
  const allResults = Object.values(updatedSession?.results ?? {})
  const totalScore =
    allResults.length > 0
      ? Math.round(
          allResults.reduce((sum, r) => sum + (r?.percent ?? 0), 0) / allResults.length
        )
      : 0

  io.to(sessionId).emit('message', {
    type: 'orchestrator:complete',
    score: totalScore,
  })
}
