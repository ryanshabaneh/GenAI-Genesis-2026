'use client'

// components/ui/CodePreview.tsx
// Renders a single file suggestion from the agent with Accept/Reject controls.
// Uses Monaco Editor in read-only mode so the user can read the diff before deciding.
// On Accept: calls /api/accept to persist the file to the server session so it
// can be included in the zip export. On Reject: dims the card and marks it locally.
// Local status state ('idle' | 'accepting' | 'accepted' | 'rejected') drives the UI
// without touching the global store — this decision is ephemeral per message render.

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { acceptChange } from '@/lib/api'
import { useStore } from '@/store/useStore'
import type { CodeBlock } from '@/types'
import clsx from 'clsx'

interface CodePreviewProps {
  codeBlock: CodeBlock
  buildingId: string
  onAccepted?: (path: string) => void
  onRejected?: (path: string) => void
}

export default function CodePreview({
  codeBlock,
  buildingId,
  onAccepted,
  onRejected,
}: CodePreviewProps) {
  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'rejected'>('idle')
  const setBuildingStatus = useStore((s) => s.setBuildingStatus)
  const setScore = useStore((s) => s.setScore)
  const addChange = useStore((s) => s.addChange)

  async function handleAccept() {
    setStatus('accepting')
    // sessionId is stored in sessionStorage by useScan after the initial HTTP response
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
    } catch (err) {
      console.error('Accept change failed:', err)
      // Reset to idle so the user can retry
      setStatus('idle')
    }
  }

  function handleReject() {
    setStatus('rejected')
    onRejected?.(codeBlock.path)
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700 my-3">
      {/* File path header with action buttons */}
      <div className="flex items-center justify-between bg-gray-800 px-3 py-2">
        <span className="text-xs font-mono text-blue-400">{codeBlock.path}</span>
        {status === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              className="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors"
            >
              Accept
            </button>
            <button
              onClick={handleReject}
              className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              Reject
            </button>
          </div>
        )}
        {status === 'accepting' && (
          <span className="text-xs text-gray-400">Saving…</span>
        )}
        {status === 'accepted' && (
          <span className="text-xs text-green-400 font-semibold">Accepted ✓</span>
        )}
        {status === 'rejected' && (
          <span className="text-xs text-gray-500">Rejected</span>
        )}
      </div>

      {/* Monaco editor — read-only so user reviews before accepting, not editing */}
      {/* opacity-40 visually de-emphasizes rejected suggestions */}
      <div className={clsx(status === 'rejected' && 'opacity-40')}>
        <Editor
          height="200px"
          language={codeBlock.language}
          value={codeBlock.content}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  )
}
