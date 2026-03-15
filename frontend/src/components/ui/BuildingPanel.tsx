'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { percentToStage } from '@/lib/stages'
import ChatWindow from './ChatWindow'
import TaskChecklist from './TaskChecklist'
import PolyProgress from './PolyProgress'
import PlatformPicker from './PlatformPicker'
import { useImplement } from '@/hooks/useImplement'
import { useBuildingFlow } from '@/hooks/useBuildingFlow'
import { setDeployPlatform } from '@/lib/api'
import type { BuildingId } from '@/types'

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 32 : -32, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } },
  exit: (dir: number) => ({ x: dir > 0 ? -32 : 32, opacity: 0, scale: 0.97, transition: { duration: 0.18 } }),
}

const STEP_INDEX: Record<string, number> = {
  OVERVIEW: 0, TASKLIST: 1, CHAT: 2, REVIEW: 3, COMPLETE: 4,
}

export default function BuildingPanel() {
  const activeBuilding    = useStore((s) => s.activeBuilding)
  const setActiveBuilding = useStore((s) => s.setActiveBuilding)
  if (!activeBuilding) return null
  return <PanelInner key={activeBuilding} buildingId={activeBuilding} onClose={() => setActiveBuilding(null)} />
}

function PanelInner({ buildingId, onClose }: { buildingId: BuildingId; onClose: () => void }) {
  const state      = useStore((s) => s.buildings[buildingId])
  const config     = BUILDINGS.find((b) => b.id === buildingId)!
  const isComplete = percentToStage(state.percent) === 'complete'
  const flow       = useBuildingFlow(buildingId)
  const stepIdx    = STEP_INDEX[flow.step] ?? 0

  useEffect(() => {
    if (isComplete && flow.step !== 'COMPLETE') flow.goComplete()
  }, [isComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingTasks = state.tasks.filter((t) => !t.done)

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0,  opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="absolute right-4 top-4 w-[22rem] flex flex-col overlay game-border rounded-[18px] overflow-hidden"
      style={{ maxHeight: 'calc(100% - 2rem)' }}
    >
      <PanelHeader config={config} step={flow.step} canGoBack={flow.canGoBack} onBack={flow.back} onClose={onClose} />

      <div className="px-5 pt-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">Readiness</span>
          <span className="text-xs font-display font-black gradient-progress-text tabular-nums">{state.percent}%</span>
        </div>
        <PolyProgress value={state.percent} segments={12} height={10} animated={state.implementStatus === 'running'} fromColor={config.theme.gradient.from} toColor={config.theme.gradient.to} />
      </div>

      <div className="overflow-y-auto">
        <AnimatePresence mode="wait" custom={stepIdx}>
          <motion.div key={flow.step} custom={stepIdx} variants={stepVariants} initial="enter" animate="center" exit="exit" className="">
            {flow.step === 'OVERVIEW'  && <StepOverview buildingId={buildingId} config={config} isComplete={isComplete} pendingCount={pendingTasks.length} onInspect={flow.goTasklist} />}
            {flow.step === 'TASKLIST'  && <StepTasklist buildingId={buildingId} state={state} pendingTasks={pendingTasks} onChat={flow.goChat} />}
            {flow.step === 'CHAT'      && <StepChat buildingId={buildingId} onTasklist={flow.goTasklist} />}
            {flow.step === 'REVIEW'    && <StepReview buildingId={buildingId} onDone={flow.goTasklist} />}
            {flow.step === 'COMPLETE'  && <StepComplete buildingId={buildingId} config={config} percent={state.percent} onBack={flow.goTasklist} onChat={flow.goChat} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function PanelHeader({ config, step, canGoBack, onBack, onClose }: {
  config: typeof BUILDINGS[0]
  step: string
  canGoBack: boolean
  onBack: () => void
  onClose: () => void
}) {
  const stepLabel: Record<string, string> = { OVERVIEW: '', TASKLIST: 'Tasks', CHAT: 'Agent', REVIEW: 'Review', COMPLETE: 'Complete' }
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {canGoBack && (
          <button onClick={onBack} aria-label="Go back" className="shrink-0 mt-1 text-fog hover:text-cyan transition-colors duration-[120ms] text-sm">←</button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">{config?.category}</p>
            {stepLabel[step] && (
              <span className="text-[9px] font-display font-black uppercase tracking-[1.5px] text-cyan/60 bg-cyan/10 px-1.5 py-0.5 rounded-full">{stepLabel[step]}</span>
            )}
          </div>
          <h2 className="text-white font-display font-black text-lg leading-tight mt-0.5">{config?.name}</h2>
        </div>
      </div>
      <button onClick={onClose} aria-label="Close panel" className="text-fog hover:text-white text-lg leading-none transition-colors duration-[120ms] shrink-0 mt-0.5 ml-2">✕</button>
    </div>
  )
}

function StepOverview({ buildingId, config, isComplete, pendingCount, onInspect }: {
  buildingId: BuildingId
  config: typeof BUILDINGS[0]
  isComplete: boolean
  pendingCount: number
  onInspect: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const chosenPlatform = useStore((s) => s.chosenPlatform)
  const setChosenPlatform = useStore((s) => s.setChosenPlatform)
  const recommendation = useStore((s) => s.deploymentRecommendation)
  const isDeployment = buildingId === 'deployment'

  const handleInspect = () => {
    // Show platform picker for deployment if no platform chosen yet
    if (isDeployment && !chosenPlatform && !isComplete) {
      setShowPicker(true)
      return
    }
    onInspect()
  }

  const handlePlatformSelect = async (platform: string) => {
    setChosenPlatform(platform)
    setShowPicker(false)
    // Persist to server
    const sessionId = sessionStorage.getItem('shipyard_session_id') ?? ''
    if (sessionId) {
      try { await setDeployPlatform({ sessionId, platform }) } catch { /* best effort */ }
    }
    onInspect()
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="text-white/70 text-sm font-ui leading-relaxed">
        {config.description}
      </motion.p>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="bg-surface2 rounded-[12px] px-4 py-3 flex flex-col gap-1">
        {isComplete ? (
          <p className="text-teal text-xs font-display font-black uppercase tracking-[1px]">✓ Fully operational</p>
        ) : (
          <>
            <p className="text-white/80 text-xs font-ui">
              <span className="text-blue font-black">{pendingCount} task{pendingCount !== 1 ? 's' : ''}</span> remaining to reach production-ready.
            </p>
            <p className="text-fog text-[11px] font-ui">Your specialist agent is ready to help.</p>
          </>
        )}
        {isDeployment && chosenPlatform && (
          <p className="text-cyan text-[10px] font-display font-black uppercase tracking-[1px] mt-1">
            Target: {chosenPlatform}
          </p>
        )}
      </motion.div>

      <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        onClick={handleInspect}
        className="w-full py-3 rounded-[12px] bg-blue/20 border border-blue/30 text-blue font-display font-black text-sm uppercase tracking-[1.5px] hover:bg-blue/30 hover:border-blue/50 transition-all duration-[150ms] active:scale-[0.98]">
        {isComplete ? 'View Summary' : 'Inspect Building →'}
      </motion.button>

      {isDeployment && (
        <PlatformPicker
          isOpen={showPicker}
          recommended={recommendation?.platform ?? null}
          onSelect={handlePlatformSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function StepTasklist({ buildingId, state, pendingTasks, onChat }: {
  buildingId: BuildingId
  state: ReturnType<typeof useStore.getState>['buildings'][BuildingId]
  pendingTasks: typeof state.tasks
  onChat: () => void
}) {
  const { runImplement, isRunning } = useImplement(buildingId)
  const toggleTaskSelected = useStore((s) => s.toggleTaskSelected)

  const pendingIds = pendingTasks.map((t) => t.id)
  const selectedIds = state.selectedTaskIds ?? []
  // When tasks are selected, use only those; otherwise use all pending (default)
  const taskIdsToFix =
    selectedIds.length > 0
      ? pendingIds.filter((id) => selectedIds.includes(id))
      : pendingIds

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div>
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px] mb-3">
          Checklist — {state.tasks.filter((t) => t.done).length}/{state.tasks.length} done
        </p>
        <TaskChecklist
          tasks={state.tasks}
          selectedTaskIds={selectedIds}
          onTaskClick={(taskId) => toggleTaskSelected(buildingId, taskId)}
        />
      </div>

      {pendingTasks.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 stagger-item" style={{ animationDelay: '0.35s' }}>
          <button onClick={onChat} className="w-full py-2.5 rounded-[10px] bg-cyan/10 border border-cyan/25 text-cyan text-xs font-display font-black uppercase tracking-[1px] hover:bg-cyan/20 hover:border-cyan/40 transition-all duration-[150ms] active:scale-[0.98]">
            Talk to Agent →
          </button>
          <button disabled={isRunning} onClick={() => runImplement(taskIdsToFix)}
            className="w-full py-2.5 rounded-[10px] bg-blue/20 border border-blue/30 text-blue text-xs font-display font-black uppercase tracking-[1px] hover:bg-blue/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-[150ms] active:scale-[0.98]">
            {isRunning ? 'Working…' : 'Auto-fix'}
          </button>
        </div>
      )}

      {pendingTasks.length === 0 && (
        <p className="text-teal text-xs font-ui text-center py-2 stagger-item">✓ All tasks complete.</p>
      )}
    </div>
  )
}

function StepChat({ buildingId, onTasklist }: { buildingId: BuildingId; onTasklist: () => void }) {
  const state = useStore((s) => s.buildings[buildingId])
  const { runEvaluate, runVerify, isRunning } = useImplement(buildingId)
  const pendingIds = state.tasks.filter((t) => !t.done).map((t) => t.id)
  const selectedIds = state.selectedTaskIds ?? []
  const taskIdsToEval = selectedIds.length > 0 ? pendingIds.filter((id) => selectedIds.includes(id)) : pendingIds
  const isDeployment = buildingId === 'deployment'

  return (
    <div className="flex flex-col" style={{ minHeight: '480px' }}>
      <div className="px-5 pt-3 pb-1">
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
          Builder Agent — {BUILDINGS.find((b) => b.id === buildingId)?.category}
        </p>
      </div>
      <div className="flex-1 overflow-hidden" style={{ minHeight: '320px' }}>
        <ChatWindow buildingId={buildingId} />
      </div>
      <div className="px-5 py-3 border-t border-white/[0.06] flex gap-2">
        <button disabled={isRunning} onClick={() => runEvaluate(taskIdsToEval)}
          className="flex-1 py-2.5 rounded-[10px] bg-surface3 border border-white/10 text-fog text-xs font-display font-black uppercase tracking-[1px] hover:bg-surface3/80 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all duration-[150ms] active:scale-[0.98]">
          {isRunning ? 'Working…' : 'Evaluate'}
        </button>
        {isDeployment && (
          <button disabled={isRunning} onClick={runVerify}
            className="flex-1 py-2.5 rounded-[10px] bg-teal/10 border border-teal/25 text-teal text-xs font-display font-black uppercase tracking-[1px] hover:bg-teal/20 hover:border-teal/40 disabled:opacity-40 disabled:pointer-events-none transition-all duration-[150ms] active:scale-[0.98]">
            {isRunning ? 'Working…' : 'Verify Build'}
          </button>
        )}
        <button onClick={onTasklist}
          className="flex-1 py-2.5 rounded-[10px] bg-cyan/10 border border-cyan/25 text-cyan text-xs font-display font-black uppercase tracking-[1px] hover:bg-cyan/20 hover:border-cyan/40 transition-all duration-[150ms] active:scale-[0.98]">
          Task List
        </button>
      </div>
    </div>
  )
}

function StepReview({ buildingId, onDone }: { buildingId: BuildingId; onDone: () => void }) {
  const buildingChanges = useStore((s) => s.changesQueue.filter((c) => c.buildingId === buildingId))

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div>
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px] mb-3">
          Pending changes — {buildingChanges.length} file{buildingChanges.length !== 1 ? 's' : ''}
        </p>
        {buildingChanges.length === 0 ? (
          <div className="bg-surface2 rounded-[12px] px-4 py-3">
            <p className="text-fog text-xs font-ui">No pending changes to review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 stagger-parent">
            {buildingChanges.map((change, i) => (
              <div key={`${change.buildingId}-${i}`} className="stagger-item bg-surface2 rounded-[10px] px-3 py-2 border border-white/5">
                <p className="text-cyan text-[11px] font-mono truncate">{change.buildingId}</p>
                <p className="text-fog text-[11px] font-ui mt-0.5">{change.files?.length ?? 0} file{(change.files?.length ?? 0) !== 1 ? 's' : ''} changed</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onDone} className="w-full py-2.5 rounded-[10px] bg-teal/15 border border-teal/30 text-teal text-xs font-display font-black uppercase tracking-[1px] hover:bg-teal/25 transition-all duration-[150ms] active:scale-[0.98] stagger-item" style={{ animationDelay: '0.3s' }}>
        Back to Tasks
      </button>
    </div>
  )
}

function StepComplete({ buildingId, config, percent, onBack, onChat }: {
  buildingId: BuildingId
  config: typeof BUILDINGS[0]
  percent: number
  onBack: () => void
  onChat: () => void
}) {
  const recommendation = useStore((s) => s.deploymentRecommendation)
  const isDeployment = buildingId === 'deployment'

  return (
    <div className="px-5 py-8 flex flex-col items-center gap-5 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-teal/20 border border-teal/40 flex items-center justify-center text-3xl"
        style={{ animation: 'float-badge 3s ease-in-out infinite' }}
      >✓</motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h3 className="text-white font-display font-black text-xl">{config.name} is live</h3>
        <p className="text-teal font-display font-black text-3xl mt-1">{percent}%</p>
        <p className="text-fog text-xs font-ui mt-2 leading-relaxed max-w-[200px] mx-auto">
          {config.category} is fully operational and production-ready.
        </p>
      </motion.div>

      {isDeployment && recommendation && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="w-full bg-surface2 rounded-[12px] px-4 py-3 text-left">
          <p className="text-blue text-[10px] font-display font-black uppercase tracking-[1.5px] mb-2">
            Recommended Platform
          </p>
          <p className="text-white text-sm font-display font-black capitalize">{recommendation.platform}</p>
          <p className="text-fog text-[11px] font-ui mt-1 leading-relaxed">{recommendation.reason}</p>
          {recommendation.services.length > 0 && (
            <p className="text-fog text-[10px] font-ui mt-1.5">
              Services: {recommendation.services.join(', ')}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-1">
            {recommendation.steps.slice(0, 4).map((step, i) => (
              <p key={i} className="text-white/70 text-[11px] font-ui leading-snug">
                <span className="text-blue font-black mr-1.5">{i + 1}.</span>{step}
              </p>
            ))}
          </div>
          <button onClick={onChat}
            className="w-full mt-3 py-2 rounded-[8px] bg-blue/20 border border-blue/30 text-blue text-[11px] font-display font-black uppercase tracking-[1px] hover:bg-blue/30 hover:border-blue/50 transition-all duration-[150ms] active:scale-[0.98]">
            Talk to Agent About Deploying →
          </button>
        </motion.div>
      )}

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={onBack} className="text-fog text-xs font-ui hover:text-white transition-colors duration-[120ms]">
        ← View task summary
      </motion.button>
    </div>
  )
}
