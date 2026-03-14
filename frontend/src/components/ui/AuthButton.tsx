'use client'

import { useAuth } from '@/hooks/useAuth'

export function GitHubAuthButton() {
  const { githubUser, logout } = useAuth()

  if (!githubUser) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 overlay rounded-[999px]">
      <img
        src={githubUser.avatarUrl}
        alt={githubUser.login}
        className="w-6 h-6 rounded-full"
      />
      <span className="text-white text-xs font-mono">{githubUser.login}</span>
      <button
        onClick={logout}
        className="text-fog text-xs font-ui hover:text-white transition-colors duration-[120ms] ml-1"
      >
        Sign out
      </button>
    </div>
  )
}
