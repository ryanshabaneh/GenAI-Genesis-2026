'use client'

import { useState, useEffect } from 'react'
import { useScan } from '@/hooks/useScan'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Repo {
  fullName: string
  private: boolean
  description: string | null
}

export default function RepoPickerOverlay({ scanError = false }: { scanError?: boolean }) {
  const { startScan, isScanning } = useScan()

  // — "someone else's" card
  const [externalUrl, setExternalUrl] = useState('')
  const [urlError, setUrlError] = useState('')

  // — "yours" card
  const [repos, setRepos] = useState<Repo[]>([])
  const [repoSearch, setRepoSearch] = useState('')
  const [reposLoading, setReposLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/auth/repos`, { credentials: 'include' })
      .then((r) => r.json())
      .then(({ repos }) => setRepos(repos ?? []))
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false))
  }, [])

  async function handleExternal(e: React.FormEvent) {
    e.preventDefault()
    setUrlError('')
    const trimmed = externalUrl.trim()
    if (!trimmed.includes('github.com/')) {
      setUrlError('Needs to be a GitHub URL.')
      return
    }
    await startScan(trimmed)
  }

  async function handleOwnRepo(fullName: string) {
    await startScan(`https://github.com/${fullName}`)
  }

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center animate-slide-up px-4">
      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="text-center mb-2">
          <h2 className="font-display text-2xl font-black text-white tracking-tight">
            Pick a repo to survey.
          </h2>
          {scanError
            ? <p className="text-amber text-sm mt-1">Something went wrong on our end, our bad. Try again?</p>
            : <p className="text-fog-light text-sm mt-1">Your city awaits.</p>
          }
        </div>

        <div className="grid grid-cols-2 gap-4">

          {/* Left — someone else's */}
          <form
            onSubmit={handleExternal}
            className="overlay rounded-[18px] flex flex-col gap-4 p-6"
          >
            <div>
              <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
                Someone else's
              </span>
              <p className="text-white font-display font-black text-lg mt-1 leading-snug">
                Steal a stranger's codebase. (Just kidding, we won't store it.)
              </p>
              <p className="text-fog-light text-xs mt-1">We won't tell.</p>
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              <input
                type="text"
                value={externalUrl}
                onChange={(e) => { setExternalUrl(e.target.value); setUrlError('') }}
                placeholder="github.com/user/repo"
                disabled={isScanning}
                className={`w-full px-3 py-2.5 rounded-[10px] bg-surface2 border text-white text-sm font-mono placeholder:text-fog focus:outline-none transition-colors duration-[120ms] ${
                  urlError ? 'border-amber' : 'border-white/10 focus:border-amber/40'
                }`}
              />
              {urlError && <p className="text-amber text-xs">{urlError}</p>}
              <button
                type="submit"
                disabled={isScanning || !externalUrl.trim()}
                className="w-full py-2.5 rounded-[999px] bg-amber text-ink font-display font-black text-sm transition-all duration-[120ms] hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isScanning ? 'Surveying…' : 'Survey the land'}
              </button>
            </div>
          </form>

          {/* Right — own repos */}
          <div className="overlay rounded-[18px] flex flex-col gap-4 p-6">
            <div>
              <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
                Yours
              </span>
              <p className="text-white font-display font-black text-lg mt-1 leading-snug">
                Time to face the music, but we'll be with you every step of the way.
              </p>
              <p className="text-fog-light text-xs mt-1">How ship-ready are you, really?</p>
            </div>

            <input
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder="Search repos…"
              className="w-full px-3 py-2 rounded-[10px] bg-surface2 border border-white/10 text-white text-sm font-mono placeholder:text-fog focus:outline-none focus:border-amber/40 transition-colors duration-[120ms]"
            />

            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-48 mt-auto">
              {reposLoading && (
                <p className="text-fog text-xs text-center py-4">Loading your repos…</p>
              )}
              {!reposLoading && filtered.length === 0 && (
                <p className="text-fog text-xs text-center py-4">No repos found.</p>
              )}
              {filtered.map((repo) => (
                <button
                  key={repo.fullName}
                  onClick={() => handleOwnRepo(repo.fullName)}
                  disabled={isScanning}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-surface2 border border-white/5 hover:border-amber-border hover:bg-surface3 text-left transition-all duration-[120ms] group disabled:opacity-40"
                >
                  <div className="min-w-0">
                    <p className="text-white text-sm font-mono truncate group-hover:text-amber transition-colors duration-[120ms]">
                      {repo.fullName.split('/')[1]}
                    </p>
                    {repo.description && (
                      <p className="text-fog text-xs truncate mt-0.5">{repo.description}</p>
                    )}
                  </div>
                  {repo.private && (
                    <span className="text-fog text-[10px] font-display font-black uppercase tracking-wider ml-2 shrink-0">
                      Private
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
