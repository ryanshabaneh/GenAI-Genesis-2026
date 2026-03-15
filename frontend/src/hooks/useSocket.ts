'use client'

// hooks/useSocket.ts
// Manages a singleton Socket.IO connection to the server and translates
// incoming WebSocket events into Zustand store updates.
// The socket is created once at module level so that multiple components
// calling useSocket() share the same connection — preventing the bug where
// unmounting one component (e.g. RepoPickerOverlay) kills the socket
// mid-scan.

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useStore } from '@/store/useStore'
import type { WsMessage } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Module-level singleton — created once, shared across all useSocket() callers
let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, { transports: ['websocket'] })
  }
  return socket
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)

  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScanStatus = useStore((s) => s.setScanStatus)
  const setScore = useStore((s) => s.setScore)

  useEffect(() => {
    const s = getSocket()

    function onConnect() { setIsConnected(true) }
    function onDisconnect() { setIsConnected(false) }
    function onMessage(msg: WsMessage) {
      switch (msg.type) {
        case 'scanning':
          setBuildingStatus(msg.building, { status: 'scanning' })
          break
        case 'result':
          setBuildingStatus(msg.building, {
            status: msg.percent === 100 ? 'complete' : msg.percent > 0 ? 'partial' : 'empty',
            percent: msg.percent,
            tasks: msg.tasks,
          })
          break
        case 'complete':
          setScanStatus('complete')
          setScore(msg.score)
          break
        case 'error':
          setScanStatus('error')
          break
      }
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('message', onMessage)

    // If already connected when hook mounts, sync state
    if (s.connected) setIsConnected(true)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      s.off('message', onMessage)
      // Do NOT disconnect — other components may still need the socket
    }
  }, [setBuildingStatus, setScanStatus, setScore])

  function joinSession(sessionId: string) {
    getSocket().emit('joinSession', sessionId)
  }

  return { isConnected, joinSession }
}
