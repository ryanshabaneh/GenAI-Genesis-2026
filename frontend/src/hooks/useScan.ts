'use client'

// hooks/useScan.ts
// Orchestrates the full scan flow: POST to server → get sessionId → join
// WebSocket room → navigate to /village.
// Keeps local `isScanning` separate from global scanStatus because the local
// flag only covers the HTTP round-trip, while scanStatus covers the full
// background scan lifecycle driven by WebSocket events.

import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { startScan as apiStartScan } from '@/lib/api'
import { useSocket } from './useSocket'

export function useScan() {
  const [isScanning, setIsScanning] = useState(false)
  const setRepoUrl = useStore((s) => s.setRepoUrl)
  const setScanStatus = useStore((s) => s.setScanStatus)
  const { joinSession } = useSocket()

  async function startScan(url: string) {
    setIsScanning(true)
    setScanStatus('scanning')
    setRepoUrl(url)

    try {
      const { sessionId } = await apiStartScan(url)
      // Join the Socket.IO room keyed to this session so we receive
      // only this scan's events and not other users' scans
      joinSession(sessionId)
      // Store sessionId in sessionStorage so other components can access it
      sessionStorage.setItem('shipyard_session_id', sessionId)
    } catch (err) {
      console.error('Scan failed:', err)
      setScanStatus('error')
    } finally {
      // HTTP call is done; WebSocket will drive the rest
      setIsScanning(false)
    }
  }

  return { startScan, isScanning }
}
