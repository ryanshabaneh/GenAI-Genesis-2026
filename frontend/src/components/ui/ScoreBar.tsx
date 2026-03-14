'use client'

import { useStore } from '@/store/useStore'
import { exportChanges } from '@/lib/api'

export default function ScoreBar() {
  const score = useStore((s) => s.score)
  const changesQueue = useStore((s) => s.changesQueue)

  const isComplete = score >= 100

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

  // Gradient shifts from red → amber → teal → cyan as score climbs
  function barGradient(pct: number): string {
    if (pct >= 100) return 'linear-gradient(90deg, #06b6d4, #14b8a6)'
    if (pct >= 75)  return 'linear-gradient(90deg, #f59e0b, #14b8a6)'
    if (pct >= 50)  return 'linear-gradient(90deg, #f59e0b, #84cc16)'
    return 'linear-gradient(90deg, #ef4444, #f59e0b)'
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900 bg-opacity-90 rounded-xl px-4 py-3 backdrop-blur-sm min-w-[240px]">
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
          <span className={`text-sm font-bold ${isComplete ? 'text-teal-400' : 'text-white'}`}>{score}%</span>
        </div>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1">
        <div
          className="h-1 rounded-full transition-all duration-[380ms] ease-in-out"
          style={{ width: `${score}%`, background: barGradient(score) }}
        />
      </div>
    </div>
  )
}
