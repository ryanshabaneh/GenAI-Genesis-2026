'use client'

import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import clsx from 'clsx'

export default function ScanProgress() {
  const buildings = useStore((s) => s.buildings)

  const doneCount = BUILDINGS.filter((b) => {
    const s = buildings[b.id].status
    return s !== 'idle' && s !== 'scanning'
  }).length

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="overlay rounded-[18px] px-6 py-6 w-full max-w-sm pointer-events-auto animate-slide-up hover-lift">

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-black text-white text-lg">Surveying the land…</h2>
            <span className="text-fog text-xs font-mono">{doneCount}/{BUILDINGS.length}</span>
          </div>
          <p className="text-fog-light text-xs">Scout is checking every district.</p>
        </div>

        {/* Building rows */}
        <ul className="flex flex-col gap-1.5">
          {BUILDINGS.map((cfg) => {
            const state = buildings[cfg.id]
            const isScanning = state.status === 'scanning'
            const isDone = state.status !== 'idle' && state.status !== 'scanning'

            return (
              <li
                key={cfg.id}
                className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-[10px] text-sm transition-all duration-[220ms]',
                  isScanning && 'bg-cyan-dim border border-cyan-border hover:scale-[1.02]',
                  isDone     && 'bg-teal-dim border border-teal-border hover:scale-[1.02] hover:brightness-110',
                  !isScanning && !isDone && 'border border-transparent opacity-40'
                )}
              >
                <span className={clsx(
                  'font-ui font-semibold',
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
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
