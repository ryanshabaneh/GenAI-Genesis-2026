'use client'

import { useState, useEffect } from 'react'
import { useScan } from '@/hooks/useScan'
import Folder from '@/components/ui/Folder'
import CubeButton from '@/components/ui/buttonstyles/CubeButton'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Repo {
  fullName: string
  private: boolean
  description: string | null
}

const CYAN = '#22D3EE'

export default function RepoPickerOverlay({ scanError = false }: { scanError?: boolean }) {
  const { startScan, isScanning } = useScan()

  const [externalUrl, setExternalUrl]   = useState('')
  const [urlError, setUrlError]         = useState('')
  const [repos, setRepos]               = useState<Repo[]>([])
  const [repoSearch, setRepoSearch]     = useState('')
  const [reposLoading, setReposLoading] = useState(true)
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [hoveredRepo, setHoveredRepo]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/auth/repos`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ repos }) => setRepos(repos ?? []))
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false))
  }, [])

  async function handleExternal() {
    setUrlError('')
    const trimmed = externalUrl.trim()
    if (!trimmed.includes('github.com/')) { setUrlError('Enter a valid GitHub URL.'); return }
    await startScan(trimmed)
  }

  function handleOwnRepo(fullName: string) {
    setSelectedRepo(fullName)
  }

  async function handleConfirmRepo() {
    if (!selectedRepo) return
    await startScan(`https://github.com/${selectedRepo}`)
  }

  const filtered = repos.filter(r =>
    r.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(3,5,12,0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: '800px',
          margin: '0 24px',
          background: 'linear-gradient(150deg, rgba(13,17,30,0.99) 0%, rgba(8,11,21,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          boxShadow: '0 48px 120px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Inner blueprint grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: [
              'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)',
            ].join(','),
            backgroundSize: '44px 44px',
          }}
        />

        {/* ── Top bar ── */}
        <div
          className="relative flex items-center justify-between px-7 py-3.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${CYAN}) drop-shadow(0 0 12px ${CYAN}66)` }}>
              <circle cx="12" cy="5" r="2"/>
              <line x1="12" y1="7" x2="12" y2="19"/>
              <path d="M6 12H3l3 4"/>
              <path d="M18 12h3l-3 4"/>
              <path d="M6 19c0 2 2.686 3 6 3s6-1 6-3"/>
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              Shipyard
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: isScanning ? '#F59E0B' : CYAN, boxShadow: `0 0 5px ${isScanning ? '#F59E0B' : CYAN}88` }} />
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {isScanning ? 'scanning' : 'ready'}
            </span>
          </div>
        </div>

        {/* ── Heading ── */}
        <div
          className="relative px-7 py-6"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <h1
            className="font-display font-bold text-white leading-none"
            style={{ fontSize: 'clamp(28px, 3.8vw, 38px)', letterSpacing: '-0.5px' }}
          >
            {scanError ? 'Something went wrong.' : 'Choose a repository.'}
          </h1>
          {!scanError && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '6px', fontFamily: 'var(--font-ui)' }}>
              Turn your codebase into a navigable city.
            </p>
          )}
        </div>

        {/* ── Body: 3-row × 2-col grid — buttons share the same row ── */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '1fr 1.7fr',
            gridTemplateRows: 'auto 1fr auto',
          }}
        >
          {/* ── Row 1: labels ── */}
          <div className="px-7 pt-6 pb-3" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              01 — Public repo
            </p>
          </div>
          <div className="px-7 pt-6 pb-3">
            <p style={{ color: 'rgba(255,255,255,0.22)', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              02 — Your repositories
            </p>
          </div>

          {/* ── Row 2: content ── */}
          <div className="flex items-center justify-center px-7 py-4" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <Folder color="#22D3EE" size={0.9} />
          </div>
          <div className="px-7 py-4">
            {/* Search */}
            <div className="relative mb-3">
              <svg
                className="absolute"
                style={{ left: '2px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                placeholder="Search…"
                className="w-full text-white placeholder:text-white/20 focus:outline-none transition-all duration-150"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 0,
                  padding: '6px 6px 8px 20px',
                }}
                onFocus={e => { e.currentTarget.style.borderBottomColor = `rgba(34,211,238,0.45)` }}
                onBlur={e => { e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* Repo list */}
            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
              {reposLoading && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '32px 0' }}>
                  Loading…
                </p>
              )}
              {!reposLoading && filtered.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '32px 0' }}>
                  No repositories found.
                </p>
              )}
              {filtered.map(repo => {
                const isSelected = selectedRepo === repo.fullName
                const isHovered  = hoveredRepo  === repo.fullName
                const repoName   = repo.fullName.split('/')[1]
                const active     = isSelected || isHovered

                return (
                  <button
                    key={repo.fullName}
                    onClick={() => handleOwnRepo(repo.fullName)}
                    disabled={isScanning}
                    onMouseEnter={() => setHoveredRepo(repo.fullName)}
                    onMouseLeave={() => setHoveredRepo(null)}
                    className="w-full text-left transition-all duration-100 disabled:opacity-40"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 8px 9px 10px',
                      borderRadius: '5px',
                      borderLeft: `2px solid ${isSelected ? CYAN : 'transparent'}`,
                      marginLeft: '-2px',
                      background: isSelected
                        ? 'rgba(34,211,238,0.06)'
                        : isHovered
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      color: isSelected ? 'rgba(255,255,255,0.95)' : active ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.58)',
                      transition: 'color 0.1s',
                      letterSpacing: '-0.1px',
                    }}>
                      {repoName}
                    </span>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {repo.private && (
                        <span style={{
                          color: 'rgba(255,255,255,0.18)',
                          fontSize: '8px',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '1.5px',
                          textTransform: 'uppercase',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                        }}>
                          pvt
                        </span>
                      )}
                      <span style={{
                        color: isSelected ? `rgba(34,211,238,0.75)` : 'rgba(255,255,255,0.28)',
                        fontSize: '13px',
                        opacity: active ? 1 : 0,
                        transition: 'opacity 0.1s',
                      }}>
                        →
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Row 3: footer buttons — same grid row = guaranteed alignment ── */}
          <div className="px-7 pb-6 pt-3 flex flex-col gap-2" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            <input
              type="text"
              value={externalUrl}
              onChange={e => { setExternalUrl(e.target.value); setUrlError('') }}
              placeholder="github.com/owner/repo"
              disabled={isScanning}
              className="repo-url-input w-full text-white focus:outline-none transition-all duration-150 disabled:opacity-40"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                background: urlError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${urlError ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.09)'}`,
                borderRadius: '7px',
                padding: '9px 11px',
                color: 'white',
              }}
              onFocus={e => { if (!urlError) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
              onBlur={e => { if (!urlError) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)' }}
            />
            {urlError && (
              <span style={{ color: 'rgba(239,68,68,0.65)', fontSize: '11px', fontFamily: 'var(--font-ui)' }}>{urlError}</span>
            )}
            <CubeButton
              label={isScanning ? 'Surveying…' : 'Survey →'}
              onClick={handleExternal}
              width="100%"
              className={isScanning || !externalUrl.trim() ? 'pointer-events-none opacity-30' : ''}
            />
          </div>

          <div className={`px-7 pb-6 pt-3 ${!selectedRepo ? 'invisible' : ''} ${isScanning ? 'pointer-events-none opacity-30' : ''}`}>
            <CubeButton
              label={isScanning ? 'Surveying…' : selectedRepo ? `Survey ${selectedRepo.split('/')[1]} →` : 'Survey →'}
              onClick={handleConfirmRepo}
              width="100%"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
