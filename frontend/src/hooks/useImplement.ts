'use client'

// hooks/useImplement.ts
// Drives the implement + evaluate flows for a building's tasks.
// Sets implementStatus in the store so UI can show loading state.
// Progress events arrive via SocketContext during the HTTP call.

import { useStore } from '@/store/useStore'
import { implementTasks, evaluateTasks } from '@/lib/api'
import type { BuildingId } from '@/types'

export function useImplement(buildingId: BuildingId) {
  const setImplementStatus = useStore((s) => s.setImplementStatus)
  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScore = useStore((s) => s.setScore)
  const isRunning = useStore((s) => s.buildings[buildingId].implementStatus === 'running')

  async function runImplement(taskIds: string[]) {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    if (!sessionId || isRunning) return

    setImplementStatus(buildingId, 'running')
    try {
      const result = await implementTasks({ sessionId, buildingId, taskIds })
      // Mark completed tasks as done in the store so checklist updates immediately
      const currentTasks = useStore.getState().buildings[buildingId].tasks
      const updatedTasks = currentTasks.map((t) => ({
        ...t,
        done: t.done || result.completedTaskIds.includes(t.id),
      }))
      setBuildingStatus(buildingId, { percent: result.percent, tasks: updatedTasks })
      setScore(result.score)
    } catch (err) {
      console.error('[useImplement] implement failed:', err)
    } finally {
      setImplementStatus(buildingId, 'idle')
    }
  }

  async function runEvaluate(taskIds?: string[]) {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    if (!sessionId || isRunning) return

    setImplementStatus(buildingId, 'running')
    try {
      const result = await evaluateTasks({ sessionId, buildingId, taskIds })

      if (result.skipped) {
        // Nothing changed since last eval — no updates needed
        console.log('[useImplement] evaluate skipped:', result.message)
        return
      }

      // Mark passing tasks as done in the store
      const currentTasks = useStore.getState().buildings[buildingId].tasks
      const passingIds = result.results.filter((r) => r.pass).map((r) => r.taskId)
      const updatedTasks = currentTasks.map((t) => ({
        ...t,
        done: t.done || passingIds.includes(t.id),
      }))
      setBuildingStatus(buildingId, { percent: result.percent, tasks: updatedTasks })
      setScore(result.score)

      // Add eval summary to local chat history so user sees it
      const passed = result.results.filter((r) => r.pass).length
      const total = result.results.length
      const summaryLines = result.results.map((r) => {
        const task = currentTasks.find((t) => t.id === r.taskId)
        const label = task?.label ?? r.taskId
        return r.pass
          ? `✓ ${label}${r.summary ? ` — ${r.summary}` : ''}`
          : `✗ ${label} — ${r.feedback ?? 'Not implemented'}`
      })
      const summaryText = `**Evaluation complete** — ${passed}/${total} passing\n\n${summaryLines.join('\n')}`
      useStore.getState().addMessage(buildingId, {
        id: `eval-${Date.now()}`,
        role: 'assistant',
        content: summaryText,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.error('[useImplement] evaluate failed:', err)
    } finally {
      setImplementStatus(buildingId, 'idle')
    }
  }

  return { runImplement, runEvaluate, isRunning }
}
