'use client'

// contexts/SocketContext.tsx
// Lifts the Socket.IO connection above any conditional renders so the socket
// is never destroyed by a component unmounting mid-scan.
// The RepoPickerOverlay unmounts when scanStatus changes to 'scanning', which
// previously destroyed the socket before any scan events arrived.
// Wrapping page.tsx with <SocketProvider> fixes that — one socket, whole session.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useStore } from '@/store/useStore'
import type { WsMessage } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface SocketContextValue {
  isConnected: boolean
  joinSession: (sessionId: string) => void
}

const SocketContext = createContext<SocketContextValue>({
  isConnected: false,
  joinSession: () => {},
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScanStatus = useStore((s) => s.setScanStatus)
  const setScore = useStore((s) => s.setScore)
  const setImplementStatus = useStore((s) => s.setImplementStatus)
  const setTaskFeedback = useStore((s) => s.setTaskFeedback)

  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket'] })
    socketRef.current = socket

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('message', (msg: WsMessage) => {
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
        case 'agent:complete':
          setImplementStatus(msg.building, 'idle')
          setBuildingStatus(msg.building, {
            status: msg.percent === 100 ? 'complete' : msg.percent > 0 ? 'partial' : 'empty',
            percent: msg.percent,
          })
          break
        case 'agent:error':
          setImplementStatus(msg.building, 'idle')
          break
        case 'task:complete':
          setTaskFeedback(msg.building, msg.taskId, msg.summary)
          break
        case 'eval:result':
          setTaskFeedback(msg.building, msg.taskId, msg.feedback)
          break
        case 'orchestrator:complete':
          setScore(msg.score)
          break
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [setBuildingStatus, setScanStatus, setScore, setImplementStatus, setTaskFeedback])

  function joinSession(sessionId: string) {
    socketRef.current?.emit('joinSession', sessionId)
  }

  return (
    <SocketContext.Provider value={{ isConnected, joinSession }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
