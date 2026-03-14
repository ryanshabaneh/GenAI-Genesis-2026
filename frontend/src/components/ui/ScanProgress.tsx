'use client'

// components/ui/ScanProgress.tsx
// Full-screen modal overlay shown while the repository scan is running.
// Lists every building and its current scan state in real time.
// Returns null immediately if scanStatus is not 'scanning', so it's
// effectively invisible outside the scan flow.
// Consumes the same buildings store slice as the 3D scene, keeping both in sync.

import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import clsx from 'clsx'

export default function ScanProgress() {
  const scanStatus = useStore((s) => s.scanStatus)
  const buildings = useStore((s) => s.buildings)

  // Only render during an active scan — parent page always mounts this component
  if (scanStatus !== 'scanning') return null

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 bg-opacity-95 flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2">Analyzing your repository…</h2>
        <p className="text-gray-400 text-sm text-center mb-8">
          Scout is surveying each area of your project.
        </p>

        <ul className="space-y-2">
          {BUILDINGS.map((cfg) => {
            const state = buildings[cfg.id]
            const isScanning = state.status === 'scanning'
            // Any status other than idle or scanning means the analyzer has returned a result
            const isDone = state.status !== 'idle' && state.status !== 'scanning'

            return (
              <li
                key={cfg.id}
                className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                  isScanning && 'bg-blue-900 text-blue-200',
                  isDone && 'bg-gray-800 text-gray-300',
                  // Queued buildings that haven't started yet are dimmed
                  !isScanning && !isDone && 'text-gray-600'
                )}
              >
                <span>
                  {cfg.emoji} {cfg.name}
                </span>
                <span>
                  {isScanning && (
                    <span className="animate-pulse text-blue-400">scanning…</span>
                  )}
                  {isDone && (
                    <span className="text-green-400 font-semibold">{state.percent}%</span>
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
