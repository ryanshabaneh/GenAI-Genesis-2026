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
  const setHasUnpushedCommits = useStore((s) => s.setHasUnpushedCommits)
  const isRunning = useStore((s) => s.buildings[buildingId].implementStatus === 'running')

  async function runImplement(taskIds: string[]) {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    if (!sessionId || isRunning) return

    console.log(`[useImplement] starting implement for ${buildingId}`, { taskIds })
    setImplementStatus(buildingId, 'running')
    try {
      const result = await implementTasks({ sessionId, buildingId, taskIds })
      console.log(`[useImplement] implement complete for ${buildingId}`, {
        completedTaskIds: result.completedTaskIds,
        percent: result.percent,
        score: result.score,
      })
      // Mark completed tasks as done in the store so checklist updates immediately
      const currentTasks = useStore.getState().buildings[buildingId].tasks
      const updatedTasks = currentTasks.map((t) => ({
        ...t,
        done: t.done || result.completedTaskIds.includes(t.id),
      }))
      setBuildingStatus(buildingId, { percent: result.percent, tasks: updatedTasks })
      setScore(result.score)
      setHasUnpushedCommits(true)
    } catch (err) {
      console.error(`[useImplement] implement failed for ${buildingId}:`, err)
    } finally {
      setImplementStatus(buildingId, 'idle')
    }
  }

  async function runEvaluate(taskIds?: string[]) {
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    if (!sessionId || isRunning) return

    console.log(`[useImplement] starting evaluate for ${buildingId}`, { taskIds })
    setImplementStatus(buildingId, 'running')
    try {
      const result = await evaluateTasks({ sessionId, buildingId, taskIds })
      const passingIds = result.results.filter((r) => r.pass).map((r) => r.taskId)
      console.log(`[useImplement] evaluate complete for ${buildingId}`, {
        passingIds,
        percent: result.percent,
        score: result.score,
      })
      // Mark passing tasks as done in the store
      const currentTasks = useStore.getState().buildings[buildingId].tasks
      const updatedTasks = currentTasks.map((t) => ({
        ...t,
        done: t.done || passingIds.includes(t.id),
      }))
      setBuildingStatus(buildingId, { percent: result.percent, tasks: updatedTasks })
      setScore(result.score)
    } catch (err) {
      console.error(`[useImplement] evaluate failed for ${buildingId}:`, err)
    } finally {
      setImplementStatus(buildingId, 'idle')
    }
  }

  return { runImplement, runEvaluate, isRunning }
}
