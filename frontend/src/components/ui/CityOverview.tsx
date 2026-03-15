'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { BUILDINGS, getBuildingConfig, iconPath } from '@/lib/buildings'
import CountUp from '@/components/text/CountUp'
import type { BuildingId } from '@/types'

// witty ambient lines — rotate by minute so it feels alive but doesn't flicker
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

// sorted: foundations first, then the rest in BUILDINGS config order
const SORTED_BUILDINGS = [
  ...BUILDINGS.filter((b) => b.isFoundation),
  ...BUILDINGS.filter((b) => !b.isFoundation),
]

// ── Mini bar ─────────────────────────────────────────────────
function MiniBar({ value, from, to }: { value: number; from: string; to: string }) {
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
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
    </div>
  )
}

// ── Building row ──────────────────────────────────────────────
function BuildingRow({ id, index }: { id: BuildingId; index: number }) {
  const config   = getBuildingConfig(id)
  const state    = useStore((s) => s.buildings[id])
  const setActive = useStore((s) => s.setActiveBuilding)

  return (
    <motion.button
      type="button"
      onClick={() => setActive(id)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left group transition-colors duration-[150ms] hover:bg-white/[0.05] active:scale-[0.98]"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.04 + index * 0.045, duration: 0.22 }}
    >
      {/* icon */}
      <div className="shrink-0 relative" style={{ width: 28, height: 28 }}>
        <Image
          src={iconPath(config.iconName)}
          alt={config.name}
          fill
          className="object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </div>

      {/* name + bar */}
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
          from={config.theme.gradient.from}
          to={config.theme.gradient.to}
        />
      </div>

      {/* percent */}
      <span
        className="shrink-0 text-sm font-action font-black tabular-nums leading-none"
        style={{ color: config.theme.primary, minWidth: '2.2rem', textAlign: 'right' }}
      >
        <CountUp to={state.percent} duration={0.9} />%
      </span>
    </motion.button>
  )
}

// ── CityOverview ──────────────────────────────────────────────
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
        <p className="text-fog text-[9px] font-mono uppercase tracking-[1.5px]">City Overview</p>
        <motion.p
          key={blurb}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-white/50 text-[11px] font-ui leading-snug mt-0.5"
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
