'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import GameModal from './GameModal'

const RailwayIcon = () => (
  <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor">
    <rect x="2" y="0" width="2" height="18" rx="1"/>
    <rect x="12" y="0" width="2" height="18" rx="1"/>
    <rect x="2" y="2" width="12" height="2" rx="1"/>
    <rect x="2" y="8" width="12" height="2" rx="1"/>
    <rect x="2" y="14" width="12" height="2" rx="1"/>
  </svg>
)

const PLATFORMS = [
  { id: 'vercel',     name: 'Vercel',      desc: 'Next.js, static sites, serverless', icon: '▲' },
  { id: 'railway',    name: 'Railway',     desc: 'Full-stack, databases, WebSockets',  icon: <RailwayIcon /> },
  { id: 'netlify',    name: 'Netlify',     desc: 'Jamstack, static + functions',       icon: '◆' },
  { id: 'render',     name: 'Render',      desc: 'Free tier backends, managed DB',     icon: '◉' },
  { id: 'fly.io',     name: 'Fly.io',      desc: 'Edge/global, VMs, real-time',        icon: '✈' },
  { id: 'cloudflare', name: 'Cloudflare',  desc: 'CDN, Workers, cheapest at scale',    icon: '☁' },
] as const

interface PlatformPickerProps {
  isOpen: boolean
  recommended?: string | null
  onSelect: (platformId: string) => void
  onClose: () => void
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function PlatformPicker({ isOpen, recommended, onSelect, onClose }: PlatformPickerProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <GameModal isOpen={isOpen} onClose={onClose} align="center" panelClassName="max-w-sm">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <div>
          <motion.h3 variants={itemVariants} className="text-white font-display font-black text-lg leading-tight">
            Choose Deploy Target
          </motion.h3>
          <motion.p variants={itemVariants} className="text-fog text-xs font-ui mt-1 leading-relaxed">
            Pick a platform and your agent will generate a ready-to-run setup script.
          </motion.p>
        </div>
        <motion.button
          variants={itemVariants}
          onClick={onClose}
          className="ml-4 shrink-0 text-fog hover:text-white text-lg leading-none transition-colors duration-[120ms]"
        >✕</motion.button>
      </div>

      {/* Platform list */}
      <motion.div variants={itemVariants} className="w-full flex flex-col gap-2">
        {PLATFORMS.map((p) => {
          const isRecommended = p.id === recommended
          const isHover = hovered === p.id
          return (
            <button
              key={p.id}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(p.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left
                transition-all duration-[150ms] active:scale-[0.98]
                ${isRecommended
                  ? 'bg-blue/15 border-blue/40 hover:bg-blue/25 hover:border-blue/60'
                  : 'bg-surface2 border-white/10 hover:bg-white/10 hover:border-white/20'}
              `}
            >
              <span className="text-base w-6 text-center shrink-0 text-white/60 flex items-center justify-center">{p.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-display font-black ${isRecommended || isHover ? 'text-white' : 'text-white/80'}`}>
                    {p.name}
                  </span>
                  {isRecommended && (
                    <span className="text-[8px] font-display font-black uppercase tracking-[1px] text-blue bg-blue/20 px-1.5 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-fog text-[10px] font-ui mt-0.5">{p.desc}</p>
              </div>
              <span className={`text-fog text-sm transition-all duration-[120ms] ${isHover ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'}`}>→</span>
            </button>
          )
        })}
      </motion.div>

      {/* Footer */}
      <motion.div
        variants={itemVariants}
        className="w-full mt-4 pt-3 flex items-center justify-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-fog/50 text-[10px] font-ui">
          Generates setup.sh + setup.ps1 for your platform
        </p>
      </motion.div>
    </GameModal>
  )
}
