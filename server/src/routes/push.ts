// server/src/routes/push.ts
// POST /api/push — pushes local commits to the remote origin.
// Handles shallow clones (--depth 1) by unshallowing first, and injects
// the user's GitHub token into the remote URL for authentication.

import { Router } from 'express'
import type { Request, Response } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getSession } from '../session/store'

const execFileAsync = promisify(execFile)
const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.body as { sessionId?: string }
  console.log('[push] received push request', { sessionId })

  if (!sessionId) {
    console.warn('[push] rejected: missing sessionId')
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  const session = getSession(sessionId)
  if (!session) {
    console.warn('[push] rejected: session not found', { sessionId })
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (!session.repoPath) {
    console.warn('[push] rejected: no repo path', { sessionId })
    res.status(400).json({ error: 'No repo path for this session' })
    return
  }

  const token = req.session.githubToken
  if (!token) {
    console.warn('[push] rejected: no GitHub token in session')
    res.status(401).json({ error: 'Not authenticated — no GitHub token' })
    return
  }

  console.log('[push] starting push for repo:', session.repoPath)

  try {
    // Unshallow if this is a shallow clone (--depth 1)
    try {
      const { stdout: shallow } = await execFileAsync(
        'git', ['rev-parse', '--is-shallow-repository'],
        { cwd: session.repoPath }
      )
      if (shallow.trim() === 'true') {
        console.log('[push] shallow clone detected, unshallowing...')
        await execFileAsync('git', ['fetch', '--unshallow'], { cwd: session.repoPath })
        console.log('[push] unshallow complete')
      }
    } catch {
      // Not shallow or fetch failed — continue anyway
      console.log('[push] shallow check skipped (not shallow or check failed)')
    }

    // Get current remote URL and inject token for auth
    const { stdout: remoteUrl } = await execFileAsync(
      'git', ['remote', 'get-url', 'origin'],
      { cwd: session.repoPath }
    )
    const cleanUrl = remoteUrl.trim()
    console.log('[push] remote URL:', cleanUrl)

    // Build authenticated URL: https://x-access-token:<token>@github.com/...
    const authedUrl = cleanUrl.replace(
      /^https:\/\//,
      `https://x-access-token:${token}@`
    )

    // Get current branch name
    const { stdout: branch } = await execFileAsync(
      'git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: session.repoPath }
    )
    console.log('[push] pushing branch:', branch.trim())

    // Check if there are commits ahead of remote before pushing
    try {
      const { stdout: status } = await execFileAsync(
        'git', ['status', '--porcelain'],
        { cwd: session.repoPath }
      )
      if (status.trim()) {
        console.log('[push] warning: working tree has uncommitted changes:\n', status.trim())
      }

      const { stdout: log } = await execFileAsync(
        'git', ['log', `origin/${branch.trim()}..HEAD`, '--oneline'],
        { cwd: session.repoPath }
      )
      if (!log.trim()) {
        console.warn('[push] no unpushed commits — nothing to push')
        res.json({ pushed: false, detail: 'No unpushed commits' })
        return
      }
      console.log('[push] unpushed commits:\n', log.trim())
    } catch {
      // origin branch may not exist yet (first push) — continue
      console.log('[push] could not check ahead/behind (may be first push)')
    }

    // Push using the authenticated URL directly (avoids mutating the saved remote)
    const { stdout: pushOut, stderr: pushErr } = await execFileAsync(
      'git', ['push', authedUrl, branch.trim()],
      { cwd: session.repoPath }
    )

    console.log('[push] push stdout:', pushOut.trim())
    if (pushErr) console.log('[push] push stderr:', pushErr.trim())
    console.log('[push] push successful')
    res.json({ pushed: true })
  } catch (err) {
    console.error('[push] git push failed:', err)
    res.status(500).json({ error: 'Push failed', detail: String(err) })
  }
})

export default router
