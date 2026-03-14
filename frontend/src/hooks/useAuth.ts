// hooks/useAuth.ts
// Checks auth status on mount by calling GET /api/auth/me.
// Populates githubUser in the Zustand store if a session exists.
// Components that need auth state should read from the store directly;
// this hook just handles the initial hydration on app load.

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export function useAuth() {
  const githubUser = useStore((s) => s.githubUser)
  const setGithubUser = useStore((s) => s.setGithubUser)

  useEffect(() => {
    fetch(`${API_URL}/api/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then(({ user }) => setGithubUser(user ?? null))
      .catch(() => setGithubUser(null))
  }, [setGithubUser])

  function logout() {
    fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
      .then(() => setGithubUser(null))
      .catch(console.error)
  }

  return { githubUser, logout }
}
