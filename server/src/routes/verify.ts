// server/src/routes/verify.ts
// POST /api/verify — runs sandboxed build verification against the cloned repo.
// Returns pass/fail with stdout/stderr so the agent and UI know if the build works.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import type { BuildingId } from '../types'
import { getSession, updateSession } from '../session/store'
import { verifyBuild, verifyStart, runSandboxed } from '../sandbox/exec'
import { calculatePercent } from '../agents/scanner-context'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId, buildingId, command } = req.body as {
    sessionId?: string
    buildingId?: BuildingId
    command?: string // optional: run a specific whitelisted command instead of full verify
  }

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (!session.repoPath) {
    res.status(409).json({ error: 'Scan is still in progress.' })
    return
  }

  const io = req.app.locals['io'] as SocketIOServer

  try {
    if (command) {
      // Run a single whitelisted command
      const result = await runSandboxed(session.repoPath, command)

      io.to(sessionId).emit('message', {
        type: 'verify:result',
        command: result.command,
        success: result.success,
        output: result.success ? result.stdout : result.stderr,
      })

      res.json(result)
      return
    }

    // Full build verification
    io.to(sessionId).emit('message', {
      type: 'verify:start',
      building: buildingId ?? 'deployment',
    })

    // Step 1: Build
    const { installResult, buildResult } = await verifyBuild(session.repoPath)

    io.to(sessionId).emit('message', {
      type: 'verify:result',
      command: 'build',
      success: buildResult.success,
      output: buildResult.success
        ? `Build passed (${buildResult.durationMs}ms)`
        : buildResult.stderr.slice(0, 500),
    })

    // Step 2: Start check (only if build passed)
    let startResult: Awaited<ReturnType<typeof verifyStart>> | null = null
    if (buildResult.success) {
      io.to(sessionId).emit('message', {
        type: 'verify:result',
        command: 'start',
        success: true,
        output: 'Starting app to check if it runs...',
      })

      startResult = await verifyStart(session.repoPath)
    }

    const allPassed = buildResult.success && (startResult?.success ?? false)

    // Update deployment tasks
    if (buildingId && session.results[buildingId]) {
      const current = session.results[buildingId]!
      const updatedTasks = current.tasks.map((t) => {
        if (t.id === 'deploy-build-verify' && buildResult.success) return { ...t, done: true }
        if (t.id === 'deploy-start-verify' && startResult?.success) return { ...t, done: true }
        return t
      })
      const percent = calculatePercent(updatedTasks)

      updateSession(sessionId, {
        results: {
          ...session.results,
          [buildingId]: { ...current, tasks: updatedTasks, percent },
        },
      })
    }

    io.to(sessionId).emit('message', {
      type: 'verify:complete',
      building: buildingId ?? 'deployment',
      success: allPassed,
      output: allPassed
        ? `Build + start passed`
        : !buildResult.success
          ? buildResult.stderr.slice(0, 500)
          : startResult?.stderr?.slice(0, 500) ?? 'Start check failed',
    })

    // Inject results into chat
    if (buildingId) {
      const freshSession = getSession(sessionId)!
      const chatHistory = freshSession.conversations[buildingId] ?? []
      const lines: string[] = ['[Deployment Verification]', '']

      if (buildResult.success) {
        lines.push(`**Build:** Passed (${buildResult.durationMs}ms)`)
      } else {
        lines.push(`**Build:** FAILED`, '', '```', buildResult.stderr.slice(0, 1000), '```')
      }

      if (startResult) {
        if (startResult.success) {
          lines.push(`**Start:** App stayed alive for 5s (${startResult.durationMs}ms)`)
          if (startResult.healthCheck) {
            lines.push(`**Health check:** HTTP ${startResult.healthCheck.status} ${startResult.healthCheck.ok ? '(OK)' : '(error)'}`)
          } else {
            lines.push(`**Health check:** No response on PORT (app may need longer to initialize, or has no root route)`)
          }
        } else {
          lines.push(`**Start:** CRASHED`, '', '```', startResult.stderr.slice(0, 1000), '```')
        }
      }

      updateSession(sessionId, {
        conversations: {
          ...freshSession.conversations,
          [buildingId]: [...chatHistory, { role: 'assistant', content: lines.join('\n') }],
        },
      })
    }

    res.json({
      install: installResult ?? null,
      build: buildResult,
      start: startResult,
    })
  } catch (err) {
    console.error('Verify error:', err)
    res.status(500).json({ error: 'Verification failed' })
  }
})

export default router
