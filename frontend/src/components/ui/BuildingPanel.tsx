'use client'

import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { percentToStage } from '@/lib/stages'
import TaskChecklist from './TaskChecklist'
import ChatWindow from './ChatWindow'

export default function BuildingPanel() {
  const activeBuilding = useStore((s) => s.activeBuilding)
  const buildings = useStore((s) => s.buildings)
  const setActiveBuilding = useStore((s) => s.setActiveBuilding)

  if (!activeBuilding) return null

  const state = buildings[activeBuilding]
  const config = BUILDINGS.find((b) => b.id === activeBuilding)
  const stage = percentToStage(state.percent)
  const isComplete = stage === 'complete'

  const progressColor = isComplete ? 'bg-teal' : 'bg-blue'
  const percentColor  = isComplete ? 'text-teal' : 'text-blue'

  return (
    <div className="absolute right-4 top-4 bottom-4 w-80 flex flex-col overlay rounded-[18px] animate-slide-in-right overflow-hidden">

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="min-w-0 pr-3">
          <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
            {config?.category}
          </p>
          <h2 className="text-white font-display font-black text-lg leading-tight mt-0.5">
            {config?.name}
          </h2>
          <p className="text-fog-light text-xs mt-1 leading-relaxed line-clamp-2">
            {config?.description}
          </p>
        </div>
        <button
          onClick={() => setActiveBuilding(null)}
          aria-label="Close panel"
          className="text-fog hover:text-white text-lg leading-none transition-colors duration-[120ms] shrink-0 mt-0.5"
        >
          ✕
        </button>
      </div>

      {/* Progress */}
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-fog text-xs font-ui">Production readiness</span>
          <span className={`text-sm font-display font-black ${percentColor}`}>
            {state.percent}%
          </span>
        </div>
        <div className="w-full bg-surface3 rounded-full h-1">
          <div
            className={`h-1 rounded-full ${progressColor} transition-all duration-[380ms] ease-in-out`}
            style={{ width: `${state.percent}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="px-5 py-3 border-b border-white/[0.06]">
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px] mb-2">
          Checklist
        </p>
        <TaskChecklist tasks={state.tasks} />
      </div>

      {/* Chat — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow buildingId={activeBuilding} />
      </div>

    </div>
  )
}
