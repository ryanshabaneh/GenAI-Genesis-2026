'use client'

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
      <div className="w-full bg-surface3 rounded-full h-1">
        <div
          className={`h-1 rounded-full transition-all duration-[380ms] ease-in-out ${isComplete ? 'bg-teal' : 'bg-amber'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
