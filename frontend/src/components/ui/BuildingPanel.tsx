'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { percentToStage } from '@/lib/stages'
import ChatWindow from './ChatWindow'
import PolyProgress from './PolyProgress'
import { useImplement } from '@/hooks/useImplement'
import { useBuildingFlow } from '@/hooks/useBuildingFlow'
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
      className="absolute right-4 top-4 bottom-4 w-[22rem] flex flex-col overlay game-border rounded-[18px] overflow-hidden"
    >
      <PanelHeader config={config} step={flow.step} canGoBack={flow.canGoBack} onBack={flow.back} onClose={onClose} />

      <div className="px-5 pt-3 pb-2 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">Readiness</span>
          <span className="text-xs font-display font-black gradient-progress-text tabular-nums">{state.percent}%</span>
        </div>
        <PolyProgress value={state.percent} segments={12} height={10} animated={state.implementStatus === 'running'} />
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={stepIdx}>
          <motion.div key={flow.step} custom={stepIdx} variants={stepVariants} initial="enter" animate="center" exit="exit" className="absolute inset-0 overflow-y-auto">
            {flow.step === 'OVERVIEW'  && <StepOverview config={config} isComplete={isComplete} pendingCount={pendingTasks.length} onInspect={flow.goTasklist} />}
            {flow.step === 'TASKLIST'  && <StepTasklist buildingId={buildingId} state={state} pendingTasks={pendingTasks} onChat={flow.goChat} />}
            {flow.step === 'CHAT'      && <StepChat buildingId={buildingId} />}
            {flow.step === 'REVIEW'    && <StepReview buildingId={buildingId} onDone={flow.goTasklist} />}
            {flow.step === 'COMPLETE'  && <StepComplete config={config} percent={state.percent} onBack={flow.goTasklist} />}
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

function StepOverview({ config, isComplete, pendingCount, onInspect }: {
  config: typeof BUILDINGS[0]
  isComplete: boolean
  pendingCount: number
  onInspect: () => void
}) {
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
      </motion.div>

      <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        onClick={onInspect}
        className="w-full py-3 rounded-[12px] bg-blue/20 border border-blue/30 text-blue font-display font-black text-sm uppercase tracking-[1.5px] hover:bg-blue/30 hover:border-blue/50 transition-all duration-[150ms] active:scale-[0.98]">
        {isComplete ? 'View Summary' : 'Inspect Building →'}
      </motion.button>
    </div>
  )
}

function StepTasklist({ buildingId, state, pendingTasks, onChat }: {
  buildingId: BuildingId
  state: ReturnType<typeof useStore.getState>['buildings'][BuildingId]
  pendingTasks: typeof state.tasks
  onChat: () => void
}) {
  const { runImplement, runEvaluate, isRunning } = useImplement(buildingId)
  const pendingIds = pendingTasks.map((t) => t.id)

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div>
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px] mb-3">
          Checklist — {state.tasks.filter((t) => t.done).length}/{state.tasks.length} done
        </p>
        <div className="stagger-parent flex flex-col gap-1.5">
          {state.tasks.map((task) => (
            <div key={task.id} className="stagger-item flex items-center gap-2.5 py-1.5">
              <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[9px] transition-colors duration-[200ms] ${task.done ? 'bg-teal/20 border-teal/40 text-teal' : 'bg-white/5 border-white/15 text-fog'}`}>
                {task.done ? '✓' : ''}
              </span>
              <span className={`text-xs font-ui leading-snug transition-colors duration-[200ms] line-clamp-2 ${task.done ? 'text-fog line-through decoration-fog/50' : 'text-white/80'}`}>
                {task.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pendingTasks.length > 0 && (
        <div className="flex flex-col gap-2 mt-1 stagger-item" style={{ animationDelay: '0.35s' }}>
          <button onClick={onChat} className="w-full py-2.5 rounded-[10px] bg-cyan/10 border border-cyan/25 text-cyan text-xs font-display font-black uppercase tracking-[1px] hover:bg-cyan/20 hover:border-cyan/40 transition-all duration-[150ms] active:scale-[0.98]">
            Talk to Agent →
          </button>
          <div className="flex gap-2">
            <button disabled={isRunning} onClick={() => runImplement(pendingIds)}
              className="flex-1 py-2.5 rounded-[10px] bg-blue/20 border border-blue/30 text-blue text-xs font-display font-black uppercase tracking-[1px] hover:bg-blue/30 disabled:opacity-40 disabled:pointer-events-none transition-all duration-[150ms] active:scale-[0.98]">
              {isRunning ? 'Working…' : 'Auto-fix'}
            </button>
            <button disabled={isRunning} onClick={() => runEvaluate(pendingIds)}
              className="flex-1 py-2.5 rounded-[10px] bg-surface3 border border-white/10 text-fog text-xs font-display font-black uppercase tracking-[1px] hover:bg-surface3/80 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-all duration-[150ms] active:scale-[0.98]">
              Evaluate
            </button>
          </div>
        </div>
      )}

      {pendingTasks.length === 0 && (
        <p className="text-teal text-xs font-ui text-center py-2 stagger-item">✓ All tasks complete.</p>
      )}
    </div>
  )
}

function StepChat({ buildingId }: { buildingId: BuildingId }) {
  return (
    <div className="h-full flex flex-col" style={{ minHeight: '300px' }}>
      <div className="px-5 pt-3 pb-1">
        <p className="text-fog text-[10px] font-display font-black uppercase tracking-[1.5px]">
          Builder Agent — {BUILDINGS.find((b) => b.id === buildingId)?.category}
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatWindow buildingId={buildingId} />
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

function StepComplete({ config, percent, onBack }: { config: typeof BUILDINGS[0]; percent: number; onBack: () => void }) {
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

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={onBack} className="text-fog text-xs font-ui hover:text-white transition-colors duration-[120ms]">
        ← View task summary
      </motion.button>
    </div>
  )
}
