'use client'

import { motion } from 'framer-motion'
import { FiZap, FiLock, FiCheckCircle, FiSettings, FiBox, FiFileText, FiBell, FiAnchor } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useStore } from '@/store/useStore'
import { BUILDINGS, getBuildingConfig } from '@/lib/buildings'
import CountUp from '@/components/text/CountUp'
import type { BuildingId } from '@/types'

const ICON_MAP: Record<string, IconType> = {
  flash:       FiZap,
  lock:        FiLock,
  tick:        FiCheckCircle,
  setting:     FiSettings,
  cube:        FiBox,
  'file-text': FiFileText,
  bell:        FiBell,
  rocket:      FiAnchor,
}

const BLURBS = [
  "Your city's running on vibes. Let's fix that.",
  "Click a building. Any building. (Start with the Vault.)",
  "Production-ready doesn't build itself. Well, actually...",
  "Your codebase called. It wants a Dockerfile.",
  "Every great city started with someone staring at a README.",
]
function useBlurb() {
  return BLURBS[Math.floor(Date.now() / 60000) % BLURBS.length]
}

const SORTED_BUILDINGS = [
  ...BUILDINGS.filter((b) => b.isFoundation),
  ...BUILDINGS.filter((b) => !b.isFoundation),
]

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 5, background: 'rgba(255,255,255,0.07)' }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: [0.34, 1.1, 0.64, 1] }}
        style={{ background: color }}
      />
    </div>
  )
}

function BuildingRow({ id, index }: { id: BuildingId; index: number }) {
  const config   = getBuildingConfig(id)
  const state    = useStore((s) => s.buildings[id])
  const setActive = useStore((s) => s.setActiveBuilding)

  return (
    <motion.button
      type="button"
      onClick={() => setActive(id)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left group transition-colors duration-[150ms] hover:bg-white/[0.08] active:scale-[0.98]"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 + index * 0.045, duration: 0.22 }}
    >
      <div
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
        style={{ background: `${config.theme.primary}18` }}
      >
        {(() => { const Icon = ICON_MAP[config.iconName] ?? FiZap; return <Icon size={15} color={config.theme.primary} /> })()}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-xs font-display font-black leading-none truncate group-hover:text-white transition-colors">
            {config.name}
          </span>
          {config.isFoundation && (
            <span
              className="shrink-0 text-[8px] font-mono uppercase tracking-[1px] px-1 py-px rounded-full"
              style={{
                background: `${config.theme.primary}22`,
                color: config.theme.primary,
                border: `1px solid ${config.theme.primary}44`,
              }}
            >
              foundation
            </span>
          )}
        </div>
        <MiniBar
          value={state.percent}
          color={config.theme.primary}
        />
      </div>

      <span
        className="shrink-0 text-sm font-action font-black tabular-nums leading-none"
        style={{ color: config.theme.primary, minWidth: '2.2rem', textAlign: 'right' }}
      >
        <CountUp to={state.percent} duration={0.9} />%
      </span>
    </motion.button>
  )
}

export default function CityOverview() {
  const blurb = useBlurb()

  return (
    <div
      className="w-full h-full flex flex-col rounded-[18px] overflow-hidden"
      style={{
        background:           'rgba(9,12,18,0.72)',
        backdropFilter:       'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06] shrink-0">
        <p className="nav-label text-[13px] text-fog">Yard Overview</p>
        <motion.p
          key={blurb}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-white/50 text-xs font-ui leading-snug mt-1"
        >
          {blurb}
        </motion.p>
      </div>

      {/* building rows */}
      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {SORTED_BUILDINGS.map((b, i) => (
          <BuildingRow key={b.id} id={b.id} index={i} />
        ))}
      </div>
    </div>
  )
}
