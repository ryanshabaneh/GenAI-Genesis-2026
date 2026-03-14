'use client'

// components/ui/ChatWindow.tsx
// Per-building agent chat UI. Renders message history and an input box.
// Each building has its own isolated chat thread (stored in the building's
// chatHistory slice) so conversations don't bleed across buildings.
// Code blocks returned by the agent are rendered inline as CodePreview cards.

import { useState, useRef, useEffect } from 'react'
import { useAgent } from '@/hooks/useAgent'
import CodePreview from './CodePreview'
import type { BuildingId, Message } from '@/types'
import clsx from 'clsx'

interface ChatWindowProps {
  buildingId: BuildingId
}

// Renders a single message bubble. User messages are right-aligned blue;
// assistant messages are left-aligned gray. Any code blocks in the response
// are rendered below the text bubble as interactive CodePreview cards.
function MessageBubble({ message, buildingId }: { message: Message; buildingId: BuildingId }) {
  const isUser = message.role === 'user'
  return (
    <div className={clsx('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={clsx(
          'px-3 py-2 rounded-xl text-sm max-w-[85%] whitespace-pre-wrap',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-800 text-gray-100'
        )}
      >
        {message.content}
      </div>
      {/* Render any file suggestions the agent returned as accept/reject cards */}
      {message.codeBlocks && message.codeBlocks.length > 0 && (
        <div className="w-full">
          {message.codeBlocks.map((block) => (
            <CodePreview
              key={block.path}
              codeBlock={block}
              buildingId={buildingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatWindow({ buildingId }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const { sendMessage, isLoading, chatHistory } = useAgent(buildingId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest message whenever history grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text)
  }

  // Enter sends; Shift+Enter inserts a newline (standard chat convention)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatHistory.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            Ask the agent anything about improving this area.
          </p>
        )}
        {chatHistory.map((msg) => (
          <MessageBubble key={msg.id} message={msg} buildingId={buildingId} />
        ))}
        {/* Pulsing "Thinking…" indicator while waiting for the agent response */}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-gray-800 px-3 py-2 rounded-xl text-sm text-gray-400 animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        {/* Invisible anchor div — scrollIntoView targets this to snap to bottom */}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for help improving this area…"
          disabled={isLoading}
          className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 resize-none border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={() => void handleSend()}
          disabled={isLoading || input.trim() === ''}
          className={clsx(
            'self-end px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            isLoading || input.trim() === ''
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          Send
        </button>
      </div>
    </div>
  )
}
