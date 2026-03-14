'use client'

// hooks/useSocket.ts
// Manages the Socket.IO connection to the server and translates incoming
// WebSocket events into Zustand store updates.
// This is the real-time backbone: the server emits scan progress events and
// this hook makes sure every building's status reflects them instantly.
// Only one socket instance is created per page mount (via useRef).

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useStore } from '@/store/useStore'
import type { WsMessage } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  // Pull only the actions we need — selector pattern prevents re-renders when
  // unrelated parts of the store change
  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScanStatus = useStore((s) => s.setScanStatus)
  const setScore = useStore((s) => s.setScore)

  useEffect(() => {
    // Force WebSocket transport — skip the Socket.IO polling fallback since
    // we need low-latency streaming during scans
    const socket = io(API_BASE, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    // All server events arrive on the 'message' channel as a discriminated union (WsMessage)
    socket.on('message', (msg: WsMessage) => {
      switch (msg.type) {
        case 'scanning':
          // Mark the building as in-flight so the scene can show a scanning animation
          setBuildingStatus(msg.building, { status: 'scanning' })
          break
        case 'result':
          // Server has finished analyzing one building — update its score and tasks
          setBuildingStatus(msg.building, {
            status: msg.percent === 100 ? 'complete' : msg.percent > 0 ? 'partial' : 'empty',
            percent: msg.percent,
            tasks: msg.tasks,
          })
          break
        case 'complete':
          // All buildings scanned — store the overall averaged score
          setScanStatus('complete')
          setScore(msg.score)
          break
        case 'error':
          setScanStatus('error')
          break
      }
    })

    // Disconnect on unmount to avoid ghost listeners if the component remounts
    return () => {
      socket.disconnect()
    }
  }, [setBuildingStatus, setScanStatus, setScore])

  // Called after startScan returns a sessionId — joins the Socket.IO room
  // so this client only receives events for its own scan
  function joinSession(sessionId: string) {
    socketRef.current?.emit('joinSession', sessionId)
  }

  return { isConnected, joinSession }
}
