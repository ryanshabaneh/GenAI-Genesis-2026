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
      setBuildingStatus(buildingId, { percent: result.percent })
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
      setBuildingStatus(buildingId, {
        percent: result.percent,
        tasks: result.tasks,
      })
      setScore(result.score)
    } catch (err) {
      console.error('[useImplement] evaluate failed:', err)
    } finally {
      setImplementStatus(buildingId, 'idle')
    }
  }

  return { runImplement, runEvaluate, isRunning }
}
