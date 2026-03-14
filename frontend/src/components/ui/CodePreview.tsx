'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { acceptChange } from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { CodeBlock } from '@/types'

interface CodePreviewProps {
  codeBlock: CodeBlock
  buildingId: string
  onAccepted?: (path: string) => void
  onRejected?: (path: string) => void
}

export default function CodePreview({ codeBlock, buildingId, onAccepted, onRejected }: CodePreviewProps) {
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'rejected'>('idle')
  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScore = useStore((s) => s.setScore)
  const addChange = useStore((s) => s.addChange)

  async function handleAccept() {
    setStatus('accepting')
    const sessionId = sessionStorage.getItem('shipcity_session_id') ?? ''
    try {
      const { percent, tasks, score } = await acceptChange({
        sessionId,
        buildingId: buildingId as Parameters<typeof acceptChange>[0]['buildingId'],
        files: [{ path: codeBlock.path, content: codeBlock.content, isNew: true }],
      })
      const bid = buildingId as Parameters<typeof acceptChange>[0]['buildingId']
      setBuildingStatus(bid, { percent, tasks })
      setScore(score)
      addChange({ id: `change-${Date.now()}`, buildingId: bid, files: [{ path: codeBlock.path, content: codeBlock.content, isNew: true }], acceptedAt: Date.now() })
      setStatus('accepted')
      onAccepted?.(codeBlock.path)
    } catch {
      setStatus('idle')
    }
  }

  function handleReject() {
    setStatus('rejected')
    onRejected?.(codeBlock.path)
  }

  return (
    <div className={`rounded-[10px] overflow-hidden border my-2 transition-opacity duration-[220ms] ${
      status === 'rejected' ? 'border-white/5 opacity-40' : 'border-white/10'
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between bg-surface2 px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-mono text-cyan truncate mr-3">{codeBlock.path}</span>

        <div className="flex items-center gap-2 shrink-0">
          {status === 'idle' && (
            <>
              <button
                onClick={handleReject}
                className="text-[11px] px-2.5 py-1 rounded-[999px] border border-white/10 text-fog font-display font-black transition-all duration-[120ms] active:scale-[0.97] btn-fx-glow"
              >
                Skip
              </button>
              <button
                onClick={handleAccept}
                className="text-[11px] px-2.5 py-1 rounded-[999px] bg-blue text-ink font-display font-black transition-all duration-[120ms] active:scale-[0.97] btn-fx-gradient-shift"
              >
                Accept
              </button>
            </>
          )}
          {status === 'accepting' && (
            <span className="text-[11px] text-fog font-ui animate-scan-pulse">Applying…</span>
          )}
          {status === 'accepted' && (
            <span className="text-[11px] text-teal font-display font-black">Applied ✓</span>
          )}
          {status === 'rejected' && (
            <span className="text-[11px] text-fog font-ui">Skipped</span>
          )}
        </div>
      </div>

      {/* Monaco — read-only review */}
      <Editor
        height="180px"
        language={codeBlock.language}
        value={codeBlock.content}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 12,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'off',
          renderLineHighlight: 'none',
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  )
}
