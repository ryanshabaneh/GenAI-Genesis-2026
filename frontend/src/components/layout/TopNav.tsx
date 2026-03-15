'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { FiLogOut, FiCpu } from 'react-icons/fi'
import { useStore } from '@/store/useStore'
import { getBuildingConfig, iconPath } from '@/lib/buildings'
import { GlassIconBtn } from '@/components/ui/GlassIcons'
import CubeProgress from '@/components/ui/CubeProgress'
import CountUp from '@/components/text/CountUp'

function UserAvatar({ url, login }: { url: string; login: string }) {
  return (
    <div className="relative shrink-0" style={{ width: 36, height: 36 }}>
      <Image
        src={url}
        alt={login}
        fill
        className="rounded-full object-cover"
        style={{ border: '1.5px solid rgba(255,255,255,0.15)' }}
        onError={(e) => {
          // fallback to 3d icon on broken avatar
          const t = e.currentTarget as HTMLImageElement
          t.src = iconPath('boy')
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
      <div className="flex flex-col min-w-0 leading-none">
        <span className="text-fog text-[9px] font-mono uppercase tracking-[1.5px] truncate">
          {user.login}
        </span>
        {repoName && (
          <span className="text-white text-sm font-display font-black truncate max-w-[140px]">
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
  const label    = building ? building.category : 'Production Readiness'
  const key      = building ? activeBuilding! : 'global'

  const cubeColors: [string, string, string] = building
    ? [building.theme.gradient.from, building.theme.gradient.via ?? building.theme.primary, building.theme.gradient.to]
    : ['#4F46E5', '#06B6D4', '#10B981']

  const numStyle: React.CSSProperties = building
    ? { color: building.theme.primary, fontSize: '1.6rem', lineHeight: 1 }
    : { fontSize: '1.6rem', lineHeight: 1 }
  const numClass = building
    ? 'font-action font-black tabular-nums'
    : 'gradient-progress-text gradient-shift-text font-action font-black tabular-nums'

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
            <CountUp to={value} duration={0.8} />
          </span>
          <span className="font-action font-black text-sm" style={{ color: building ? building.theme.primary : undefined, opacity: 0.7 }}>%</span>
        </motion.div>
      </AnimatePresence>

      <div className="flex flex-col gap-1 min-w-0" style={{ width: 'clamp(140px, 16vw, 260px)' }}>
        <CubeProgress
          value={value}
          height={28}
          colors={cubeColors}
          animated={!building && value > 0}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{    opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-[8px] font-mono uppercase tracking-[1.5px]"
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
    <div style={{ fontSize: 10 }}>
      <GlassIconBtn
        icon={<FiCpu size={14} />}
        color={isRunning ? 'amber' : 'cyan'}
        label={isRunning ? 'Running' : 'Agent idle'}
      />
    </div>
  )
}

function LogoutBtn() {
  function handleLogout() {
    window.location.href = '/api/auth/logout'
  }

  return (
    <div style={{ fontSize: 10 }}>
      <GlassIconBtn
        icon={<FiLogOut size={14} />}
        color="purple"
        label="Logout"
        onClick={handleLogout}
      />
    </div>
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
        overflow:             'visible', // allows GlassIcon labels to drop below nav
      }}
    >
      {/* left */}
      <div className="flex-1 flex items-center">
        <RepoIdentity />
      </div>

      {/* center */}
      <div className="flex items-center justify-center">
        <ReadinessBlock />
      </div>

      {/* right */}
      <div className="flex-1 flex items-center justify-end gap-1">
        <AgentStatusBtn />
        <LogoutBtn />
      </div>
    </nav>
  )
}
