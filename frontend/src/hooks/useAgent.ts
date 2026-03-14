'use client'

// hooks/useAgent.ts
// Scoped per-building chat hook. Wires the ChatWindow UI to the /api/chat endpoint
// and persists all messages into the building's chatHistory slice in the store.
// By scoping to a buildingId, each building's conversation is independent —
// switching between buildings in BuildingPanel doesn't mix up chat threads.

import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { sendChatMessage } from '@/lib/api'
import type { BuildingId } from '@/types'

export function useAgent(buildingId: BuildingId) {
  const [isLoading, setIsLoading] = useState(false)

  const addMessage = useStore((s) => s.addMessage)
  // Read this building's chat history from the store so it survives re-renders
  const chatHistory = useStore((s) => s.buildings[buildingId].chatHistory)

  async function sendMessage(text: string) {
    // sessionId lives in sessionStorage because it's set in useScan after the HTTP response —
    // we can't put it in the Zustand store without a timing race on navigation
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''

    // Optimistically add the user message so the UI feels instant
    const userMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    }
    addMessage(buildingId, userMessage)
    setIsLoading(true)

    try {
      const { reply } = await sendChatMessage({
        sessionId,
        buildingId,
        message: text,
        // Send the full history so the server-side agent has context for follow-up questions
        history: chatHistory,
      })
      addMessage(buildingId, {
        ...reply,
        id: `msg-${Date.now()}-assistant`,
        timestamp: Date.now(),
      })
    } catch (err) {
      console.error('Agent chat error:', err)
      // Add a synthetic error message so the user knows something went wrong
      addMessage(buildingId, {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return { sendMessage, isLoading, chatHistory }
}
