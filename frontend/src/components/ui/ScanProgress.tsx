'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import PolyProgress from './PolyProgress'
import clsx from 'clsx'

export default function ScanProgress() {
  const buildings = useStore((s) => s.buildings)

  const doneCount = BUILDINGS.filter((b) => {
    const s = buildings[b.id].status
    return s !== 'idle' && s !== 'scanning'
  }).length

  const overallPercent = Math.round(
    BUILDINGS.reduce((sum, b) => sum + buildings[b.id].percent, 0) / BUILDINGS.length
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 16, scale: 0.97  }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="overlay rounded-[20px] px-6 py-5 w-full max-w-sm pointer-events-auto hover-lift"
      >
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <motion.h2
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display font-black text-white text-lg"
            >
              Surveying the land…
            </motion.h2>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-fog text-xs font-mono"
            >
              {doneCount}/{BUILDINGS.length}
            </motion.span>
          </div>
          <p className="text-fog-light text-xs mb-3">Scout is checking every district.</p>

          <PolyProgress
            value={overallPercent}
            segments={8}
            height={8}
            animated
            showLabel
          />
        </div>

        <ul className="flex flex-col gap-1.5">
          {BUILDINGS.map((cfg, i) => {
            const state     = buildings[cfg.id]
            const isScanning = state.status === 'scanning'
            const isDone     = state.status !== 'idle' && state.status !== 'scanning'

            return (
              <motion.li
                key={cfg.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1,  x: 0   }}
                transition={{ delay: 0.08 + i * 0.045, type: 'spring', stiffness: 320, damping: 28 }}
                className={clsx(
                  'flex flex-col px-3 py-2 rounded-[10px] transition-all duration-[220ms]',
                  isScanning && 'bg-cyan-dim border border-cyan-border',
                  isDone     && 'bg-teal-dim border border-teal-border hover:brightness-110',
                  !isScanning && !isDone && 'border border-transparent opacity-35'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={clsx(
                    'font-ui font-semibold text-sm',
                    isScanning && 'text-cyan',
                    isDone     && 'text-teal',
                    !isScanning && !isDone && 'text-fog'
                  )}>
                    {cfg.name}
                  </span>
                  <span className="font-mono text-xs">
                    {isScanning && (
                      <span className="text-cyan animate-scan-pulse">scanning</span>
                    )}
                    {isDone && (
                      <span className="text-teal">{state.percent}%</span>
                    )}
                  </span>
                </div>

                {(isScanning || isDone) && (
                  <div className="mt-1.5">
                    <PolyProgress
                      value={isDone ? state.percent : 0}
                      segments={6}
                      height={5}
                      animated={isScanning}
                    />
                  </div>
                )}
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </div>
  )
}
