'use client'

// components/ui/ScoreBar.tsx
// Displays the overall production-readiness score as a colored progress bar.
// Overlaid on the bottom of the 3D scene in village/page.tsx.
// Score is the average of all building percents, computed server-side and
// sent via the 'complete' WebSocket event.

import { useStore } from '@/store/useStore'
import { exportChanges } from '@/lib/api'
import clsx from 'clsx'

export default function ScoreBar() {
  const score = useStore((s) => s.score)
  const changesQueue = useStore((s) => s.changesQueue)

  async function handleExport() {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    const blob = await exportChanges({ sessionId, format: 'zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'shipcity-fixes.zip'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Color encodes urgency: red = needs work, yellow = halfway there, green = ship it
  function scoreColor(pct: number): string {
    if (pct >= 80) return 'bg-green-500'
    if (pct >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="bg-gray-900 bg-opacity-90 rounded-xl px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-gray-300">Production Readiness</span>
        <div className="flex items-center gap-3">
          {changesQueue.length > 0 && (
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              Export ZIP ({changesQueue.length})
            </button>
          )}
          <span className="text-sm font-bold text-white">{score}%</span>
        </div>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2.5">
        {/* transition-all duration-700 smoothly animates the bar as score updates */}
        <div
          className={clsx('h-2.5 rounded-full transition-all duration-700', scoreColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{score}% Production Ready</p>
    </div>
  )
}
