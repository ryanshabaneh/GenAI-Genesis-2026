'use client'

// components/ui/BuildingPanel.tsx
// Right-column panel that appears when a building is selected in the 3D scene.
// Composed of three sections stacked vertically:
//   1. Header — building name, emoji, description, close button
//   2. Progress row — current percent and stage label
//   3. Task checklist — per-building pass/fail tasks from the analyzer
//   4. ChatWindow — agent chat fills remaining flex height
//
// When no building is active it shows an empty-state prompt instead.

import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { STAGE_CONFIG, percentToStage } from '@/lib/stages'
import TaskChecklist from './TaskChecklist'
import ChatWindow from './ChatWindow'

export default function BuildingPanel() {
  const activeBuilding = useStore((s) => s.activeBuilding)
  const buildings = useStore((s) => s.buildings)
  const setActiveBuilding = useStore((s) => s.setActiveBuilding)

  // Empty state — nothing selected yet
  if (!activeBuilding) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <p className="text-5xl mb-4">🏙️</p>
        <p className="text-gray-400 text-sm">
          Click on any building in the village to open its agent and task checklist.
        </p>
      </div>
    )
  }

  const state = buildings[activeBuilding]
  const config = BUILDINGS.find((b) => b.id === activeBuilding)
  const stage = percentToStage(state.percent)
  const stageDesc = STAGE_CONFIG[stage].description

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config?.emoji}</span>
            <span className="font-bold text-lg">{config?.name}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{config?.description}</p>
        </div>
        {/* Deselects the building, returning the panel to empty state */}
        <button
          onClick={() => setActiveBuilding(null)}
          className="text-gray-500 hover:text-white text-xl leading-none"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Progress row */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">{stageDesc}</span>
          <span className="text-sm font-bold">{state.percent}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-blue-500 transition-all duration-700"
            style={{ width: `${state.percent}%` }}
          />
        </div>
      </div>

      {/* Tasks */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Checklist
        </h3>
        <TaskChecklist tasks={state.tasks} />
      </div>

      {/* Chat — takes remaining height via flex-1 */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow buildingId={activeBuilding} />
      </div>
    </div>
  )
}
