import crypto from 'crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import type { GitHubUser } from '../types'

// Extend SessionData
declare module 'express-session' {
  interface SessionData {
    githubToken?: string
    githubUser?: GitHubUser
    oauthState?: string
  }
}

const router = Router()

const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID']
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET']
const BACKEND_URL = process.env['BACKEND_URL'] ?? 'http://localhost:3001'
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

// GET /api/auth/github
router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID) {
    res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' })
    return
  }

  const state = crypto.randomBytes(16).toString('hex')
  req.session.oauthState = state

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/auth/github/callback`,
    scope: 'repo',
    state,
  })

  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// GET /api/auth/github/callback
router.get('/github/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query as Record<string, string>

  // User denied the OAuth request on GH side
  if (error) {
    res.redirect(`${FRONTEND_URL}?auth=denied`)
    return
  }

  // CSRF check — state check
  if (!state || state !== req.session.oauthState) {
    res.status(400).json({ error: 'Invalid OAuth state — possible CSRF attempt' })
    return
  }

  delete req.session.oauthState

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.status(500).json({ error: 'GitHub OAuth credentials not configured' })
    return
  }

  // Exchange auth code
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${BACKEND_URL}/api/auth/github/callback`,
    }),
  })

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }

  if (tokenData.error || !tokenData.access_token) {
    console.error('[auth] token exchange failed:', tokenData.error)
    res.redirect(`${FRONTEND_URL}?auth=error`)
    return
  }

  // Fetch the authenticated user's GitHub profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  const userData = (await userRes.json()) as {
    login: string
    name: string | null
    avatar_url: string
  }

  // Persist token and user summary in the session
  req.session.githubToken = tokenData.access_token
  req.session.githubUser = {
    login: userData.login,
    name: userData.name ?? null,
    avatarUrl: userData.avatar_url,
  }

  res.redirect(FRONTEND_URL)
})

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  if (!req.session.githubUser) {
    res.status(401).json({ user: null })
    return
  }
  res.json({ user: req.session.githubUser })
})

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

export default router
