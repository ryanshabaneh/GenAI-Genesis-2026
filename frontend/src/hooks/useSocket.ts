'use client'

// hooks/useSocket.ts
// Re-exports useSocket from SocketContext so existing imports keep working.
// The actual socket lives in SocketProvider (contexts/SocketContext.tsx),
// which is mounted above all conditional renders in page.tsx.

export { useSocket } from '@/contexts/SocketContext'
