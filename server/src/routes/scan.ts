// server/src/routes/scan.ts
// POST /api/scan — initiates a repository scan for a given GitHub URL.
// Returns the sessionId immediately (HTTP response) so the client can join
// the WebSocket room, then runs the actual scan in the background via setImmediate.
// This fire-and-forget pattern keeps the HTTP response fast while the scan
// (clone + 14 analyzers) runs asynchronously and streams results over Socket.IO.
// After the scan completes, the user can interact with per-building agents
// via /api/chat, /api/implement, and /api/evaluate.

import { Router } from 'express'
import type { Request, Response } from 'express'
import type { Server as SocketIOServer } from 'socket.io'
import path from 'path'
import { createSession } from '../session/store'
import { cloneRepo } from '../scanner/clone'
import { runScan } from '../scanner'
const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { repoUrl } = req.body as { repoUrl?: string }

  if (!repoUrl || typeof repoUrl !== 'string') {
    res.status(400).json({ error: 'repoUrl is required' })
    return
  }

  const tempDir = process.env['TEMP_DIR'] ?? '/tmp/shipyard-repos'

  // Create session immediately with empty repoPath — we'll update it after clone
  const session = createSession({ repoUrl, repoPath: '' })

  // Return session ID immediately — scan runs in background
  // Client joins the Socket.IO room with this ID to receive streamed results
  res.json({ sessionId: session.id })

  const io = req.app.locals['io'] as SocketIOServer

  // setImmediate defers execution until the event loop is free after the HTTP response
  // is flushed — ensures the client gets the sessionId before events start arriving
  setImmediate(() => {
    void (async () => {
      try {
        const repoPath = await cloneRepo(repoUrl, path.join(tempDir, session.id))
        // Update session with actual repoPath so chat routes can find the files
        const { updateSession } = await import('../session/store')
        updateSession(session.id, { repoPath })

        await runScan(session.id, repoPath, io)
      } catch (err) {
        console.error('Scan error:', err)
        io.to(session.id).emit('message', {
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error during scan',
        })
      }
    })()
  })
})

export default router
