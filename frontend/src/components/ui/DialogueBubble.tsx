'use client'

// components/ui/DialogueBubble.tsx
// Renders the Scout NPC's current dialogue line as a floating speech bubble
// in the bottom-left corner of the screen. Reads scoutDialogue from the store;
// callers set that string via setScoutDialogue at trigger points (scan events,
// building clicks, milestones). Returns null when there's nothing to say.

import { useStore } from '@/store/useStore'

export default function DialogueBubble() {
  const scoutDialogue = useStore((s) => s.scoutDialogue)

  if (!scoutDialogue) return null

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-xs animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 shadow-xl">
        <div className="flex items-start gap-2">
          <span className="text-2xl">🦅</span>
          <p className="text-sm text-gray-100 leading-snug">{scoutDialogue}</p>
        </div>
      </div>
      {/* CSS triangle that makes the box look like a speech bubble pointing up-left */}
      <div
        className="absolute -bottom-2 left-6 w-4 h-4 bg-gray-900 border-b border-r border-gray-700 rotate-45"
        aria-hidden
      />
    </div>
  )
}
