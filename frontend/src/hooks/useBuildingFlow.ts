'use client'

import { useState, useCallback } from 'react'
import type { BuildingId } from '@/types'

export type FlowStep = 'OVERVIEW' | 'TASKLIST' | 'CHAT' | 'REVIEW' | 'COMPLETE'

export function useBuildingFlow(_buildingId: BuildingId) {
  const [stack, setStack] = useState<FlowStep[]>(['OVERVIEW'])

  const step      = stack[stack.length - 1]
  const canGoBack = stack.length > 1

  const navigate = useCallback((next: FlowStep) => {
    setStack((prev) => [...prev, next])
  }, [])

  const back  = useCallback(() => setStack((prev) => prev.length > 1 ? prev.slice(0, -1) : prev), [])
  const reset = useCallback(() => setStack(['OVERVIEW']), [])

  const goOverview = useCallback(() => navigate('OVERVIEW'),  [navigate])
  const goTasklist = useCallback(() => navigate('TASKLIST'),  [navigate])
  const goChat     = useCallback(() => navigate('CHAT'),      [navigate])
  const goReview   = useCallback(() => navigate('REVIEW'),    [navigate])
  const goComplete = useCallback(() => navigate('COMPLETE'),  [navigate])

  return { step, canGoBack, back, reset, goOverview, goTasklist, goChat, goReview, goComplete }
}
