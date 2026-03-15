'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { pushChanges } from '@/lib/api'
import { getBuildingConfig, iconPath } from '@/lib/buildings'


function UserAvatar({ url, login }: { url: string; login: string }) {
  return (
    <div className="relative shrink-0" style={{ width: 42, height: 42 }}>
      <Image
        src={url}
        alt={login}
        fill
        className="rounded-full object-cover"
        style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement
          target.src = iconPath('boy')
        }}
      />
    </div>
  )
}

function RepoIdentity() {
  const user    = useStore((s) => s.githubUser)
  const repoUrl = useStore((s) => s.repoUrl)

  const repoName = repoUrl
    ? repoUrl.replace('https://github.com/', '').split('/')[1] ?? repoUrl
    : null

  if (!user) return null

  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar url={user.avatarUrl} login={user.login} />
      <div className="flex flex-col min-w-0 leading-none gap-0.5">
        <span className="nav-label text-[11px] text-fog truncate">
          {user.login}
        </span>
        {repoName && (
          <span className="text-white text-base font-display font-black truncate max-w-[160px]">
            {repoName}
          </span>
        )}
      </div>
    </div>
  )
}

function ReadinessBlock() {
  const score          = useStore((s) => s.score)
  const activeBuilding = useStore((s) => s.activeBuilding)
  const buildings      = useStore((s) => s.buildings)

  const building = activeBuilding ? getBuildingConfig(activeBuilding) : null
  const value    = building ? buildings[activeBuilding!].percent : score
  const label    = building ? building.category + ' Progress' : 'Production Readiness'
  const key      = building ? activeBuilding! : 'global'

  const fromColor = building ? building.theme.gradient.from : '#4A78D4'
  const toColor   = building ? building.theme.gradient.to   : '#00D4FF'

  const numStyle: CSSProperties = building
    ? { color: building.theme.primary, fontSize: '2rem', lineHeight: 1 }
    : { fontSize: '2rem', lineHeight: 1 }
  const numClass = building
    ? 'font-action font-light tabular-nums'
    : 'gradient-progress-text gradient-shift-text font-action font-light tabular-nums'

  return (
    <div className="flex items-center gap-3 min-w-0">
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y:  6, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.34, 1.28, 0.64, 1] }}
          className="flex items-baseline gap-1 shrink-0"
        >
          <span className={numClass} style={numStyle}>
            {value}
          </span>
          <span className={`font-action font-light ${!building ? 'gradient-progress-text gradient-shift-text' : ''}`} style={{ color: building ? building.theme.primary : undefined, opacity: 0.7, fontSize: '2rem', lineHeight: 1 }}>%</span>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col gap-1.5 min-w-0 pt-1" style={{ width: 'clamp(220px, 28vw, 460px)' }}>
        <div
          className="bar-track"
          style={{
            height:          '22px',
            '--bar-from':    fromColor,
            '--bar-to':      toColor,
            '--bar-glow':    `${fromColor}90`,
            '--bar-border':  `${fromColor}50`,
          } as CSSProperties}
        >
          <div className="bar-fill" style={{ width: `${value}%` }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="nav-label text-[10px]"
            style={{ color: building ? building.theme.primary : undefined, opacity: building ? 0.7 : undefined }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AgentStatusBtn() {
  const buildings = useStore((s) => s.buildings)
  const isRunning = Object.values(buildings).some((b) => b.implementStatus === 'running')

  return (
    <div className="glass-text-button pointer-events-none">
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
        background: isRunning ? '#F59E0B' : '#6EE7B7',
        boxShadow: isRunning ? '0 0 8px #F59E0BAA' : '0 0 8px #6EE7B7AA',
      }} />
      {isRunning ? 'Agent Running' : 'Agent Active'}
    </div>
  )
}

function PushBtn() {
  const hasUnpushed = useStore((s) => s.hasUnpushedCommits)
  const setHasUnpushedCommits = useStore((s) => s.setHasUnpushedCommits)
  const [pushing, setPushing] = useState(false)

  if (!hasUnpushed) return null

  async function handlePush() {
    const sessionId = sessionStorage.getItem('shipyard_session_id') ?? ''
    if (!sessionId || pushing) return

    console.log('[push] push button clicked, sessionId:', sessionId)
    setPushing(true)
    try {
      const { pushed } = await pushChanges({ sessionId })
      if (pushed) {
        console.log('[push] push succeeded')
        setHasUnpushedCommits(false)
      } else {
        console.warn('[push] push returned pushed=false')
      }
    } catch (err) {
      console.error('[push] push failed:', err)
    } finally {
      setPushing(false)
    }
  }

  return (
    <button
      className="glass-text-button"
      onClick={handlePush}
      disabled={pushing}
      style={pushing ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <span style={{
        width: '0.5em', height: '0.5em', borderRadius: '50%', flexShrink: 0,
        background: '#2563EB',
        boxShadow: '0 0 6px #2563EB88',
      }} />
      {pushing ? 'pushing…' : 'push'}
    </button>
  )
}

function PushBtn() {
  const hasUnpushed = useStore((s) => s.hasUnpushedCommits)
  const setHasUnpushedCommits = useStore((s) => s.setHasUnpushedCommits)
  const [pushing, setPushing] = useState(false)

  if (!hasUnpushed) return null

  async function handlePush() {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    if (!sessionId || pushing) return

    console.log('[push] push button clicked, sessionId:', sessionId)
    setPushing(true)
    try {
      const { pushed } = await pushChanges({ sessionId })
      if (pushed) {
        console.log('[push] push succeeded')
        setHasUnpushedCommits(false)
      } else {
        console.warn('[push] push returned pushed=false')
      }
    } catch (err) {
      console.error('[push] push failed:', err)
    } finally {
      setPushing(false)
    }
  }

  return (
    <button
      className="glass-text-button"
      onClick={handlePush}
      disabled={pushing}
      style={pushing ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <span style={{
        width: '0.5em', height: '0.5em', borderRadius: '50%', flexShrink: 0,
        background: '#2563EB',
        boxShadow: '0 0 6px #2563EB88',
      }} />
      {pushing ? 'pushing…' : 'push'}
    </button>
  )
}

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

function LogoutBtn() {
  async function handleLogout() {
    await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
    window.location.href = '/'
  }

  return (
    <button className="glass-text-button" onClick={handleLogout}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: '#EF4444', boxShadow: '0 0 8px #EF4444AA' }} />
      Sign Out
    </button>
  )
}

export default function TopNav() {
  return (
    <nav
      className="w-full h-full flex items-center px-5 gap-4"
      style={{
        background:           'rgba(9,12,18,0.75)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom:         '1px solid rgba(255,255,255,0.07)',
        boxShadow:            '0 1px 0 rgba(255,255,255,0.04), 0 4px 32px rgba(0,0,0,0.45)',
        overflow:             'visible',
      }}
    >
      <div className="flex-1 flex items-center">
        <RepoIdentity />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        <ReadinessBlock />
      </div>

      <div className="flex-1 flex items-center justify-end gap-1">
        <PushBtn />
        <AgentStatusBtn />
        <LogoutBtn />
      </div>
    </nav>
  )
}
