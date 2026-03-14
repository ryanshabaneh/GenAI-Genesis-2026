'use client'

import { useStore } from '@/store/useStore'

export default function ScoreBar() {
  const score = useStore((s) => s.score)
  const isComplete = score === 100

  return (
    <div className="absolute bottom-4 left-4 w-64 overlay rounded-[14px] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
          Production Readiness
        </span>
        <span className={`text-sm font-display font-black ${isComplete ? 'text-teal' : 'text-amber'}`}>
          {score}%
        </span>
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
