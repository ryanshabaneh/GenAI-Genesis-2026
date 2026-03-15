'use client'

import { useState, useRef, useEffect } from 'react'
import { useAgent } from '@/hooks/useAgent'
import { useStore } from '@/store/useStore'
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

const SUGGESTIONS: Record<string, string[]> = {
  envVars:       ["How do I set up a .env.example file?", "Are there any hardcoded values I should move to env vars?"],
  security:      ["What secrets might be exposed in this repo?", "How do I improve my .gitignore for security?"],
  tests:         ["What test coverage am I missing?", "How do I set up a test framework for this project?"],
  cicd:          ["How do I add a GitHub Actions workflow?", "What should my CI pipeline check?"],
  docker:        ["How do I write a good Dockerfile for this project?", "Should I add a docker-compose file?"],
  documentation: ["What's missing from my README?", "How do I document my environment variables?"],
  logging:       ["How do I add structured logging?", "What log levels should I be using?"],
  deployment:    ["What's the fastest way to fix my deployment config?", "How do I add a health check endpoint?"],
}

function EmptyState({ buildingId, onSuggest }: { buildingId: BuildingId; onSuggest: (q: string) => void }) {
  const suggestions = SUGGESTIONS[buildingId] ?? []
  return (
    <div className="flex flex-col items-center gap-3 mt-3 px-2">
      <p className="text-fog text-xs text-center leading-relaxed">Ask your specialist agent anything, or try a suggestion:</p>
      <div className="flex flex-col gap-1.5 w-full">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => onSuggest(q)}
            className="text-left text-[11px] font-ui font-normal text-white/80 bg-surface2 border border-white/[0.08] rounded-[8px] px-3 py-2 leading-snug hover:border-white/20 hover:text-white transition-all duration-[120ms]"
          >
            {q}
          </button>
        ))}
      </div>
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
  const pendingChatMessage = useStore((s) => s.buildings[buildingId].pendingChatMessage)
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage)
  const pendingSentRef = useRef(false)

  // Auto-send pending message from Auto-fix button
  useEffect(() => {
    if (pendingChatMessage && !isLoading && !pendingSentRef.current) {
      pendingSentRef.current = true
      setPendingChatMessage(buildingId, undefined)
      void sendMessage(pendingChatMessage)
    }
  }, [pendingChatMessage, isLoading, buildingId, sendMessage, setPendingChatMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleSend() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {chatHistory.length === 0 && (
          <EmptyState buildingId={buildingId} onSuggest={(q) => { setInput(q) }} />
        )}
        {chatHistory.map((msg) => (
          <MessageBubble key={msg.id} message={msg} buildingId={buildingId} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-3 py-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleSend() }}}
          placeholder="Ask the agent…"
          disabled={isLoading}
          className="flex-1 bg-surface2 text-white text-xs font-ui rounded-[10px] px-4 py-3 border border-white/10 focus:outline-none focus:border-blue/40 placeholder:text-fog transition-colors duration-[120ms]"
        />
        <button
          onClick={() => void handleSend()}
          disabled={isLoading || !input.trim()}
          className="shrink-0 px-4 py-2 rounded-[10px] bg-blue/20 border border-blue/40 text-blue text-xs font-display font-black hover:bg-blue/30 hover:border-blue/60 transition-all duration-[120ms] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
        >
          Send
        </button>
      </div>
    </div>
  )
}
