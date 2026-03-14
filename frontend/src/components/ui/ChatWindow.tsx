'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgent } from '@/hooks/useAgent'
import CodePreview from './CodePreview'
import type { BuildingId, Message } from '@/types'

function MessageBubble({ message, buildingId }: { message: Message; buildingId: BuildingId }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`px-3 py-2 rounded-[10px] text-xs max-w-[88%] whitespace-pre-wrap leading-relaxed font-ui ${
        isUser
          ? 'bg-surface3 text-white'
          : 'bg-cyan-dim border border-cyan-border text-white'
      }`}>
        {message.content}
      </div>
      {message.codeBlocks && message.codeBlocks.length > 0 && (
        <div className="w-full">
          {message.codeBlocks.map((block) => (
            <CodePreview key={block.path} codeBlock={block} buildingId={buildingId} />
          ))}
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bg-cyan-dim border border-cyan-border px-3 py-2 rounded-[10px] flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-cyan animate-scan-pulse"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ChatWindow({ buildingId }: { buildingId: BuildingId }) {
  const [input, setInput] = useState('')
  const { sendMessage, isLoading, chatHistory } = useAgent(buildingId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {chatHistory.length === 0 && (
          <p className="text-fog text-xs text-center mt-8 leading-relaxed">
            Ask the agent anything about improving this area.
          </p>
        )}
        {chatHistory.map((msg) => (
          <MessageBubble key={msg.id} message={msg} buildingId={buildingId} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] p-3 flex gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agent…"
          disabled={isLoading}
          className="flex-1 bg-surface2 text-white text-xs font-ui rounded-[10px] px-3 py-2 resize-none border border-white/10 focus:outline-none focus:border-amber/40 placeholder:text-fog transition-colors duration-[120ms]"
        />
        <button
          onClick={() => void handleSend()}
          disabled={isLoading || !input.trim()}
          className="self-end px-3 py-2 rounded-[999px] bg-amber text-ink text-xs font-display font-black transition-all duration-[120ms] hover:brightness-110 hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
        >
          Send
        </button>
      </div>
    </div>
  )
}
