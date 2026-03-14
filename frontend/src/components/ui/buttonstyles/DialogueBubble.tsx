'use client'

// Scout NPC speech bubble — bottom-left, fades in when scoutDialogue is set
// purple border: Scout is the only component that gets purple (per design system)
// overlay handles the glass bg + blur; border-purple/30 overrides its default border

import { useStore } from '@/store/useStore'

export default function DialogueBubble() {
  const scoutDialogue = useStore((s) => s.scoutDialogue)

  if (!scoutDialogue) return null

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-xs animate-fade-in hover-lift">
      <div className="bg-surface backdrop-blur-[12px] border border-purple/30 rounded-2xl px-4 py-3 shadow-xl">
        <div className="flex items-start gap-2">
          <span className="text-2xl">🦅</span>
          <p className="text-sm text-white font-ui leading-snug">{scoutDialogue}</p>
        </div>
      </div>
      {/* speech bubble tail pointing up-left */}
      <div
        className="absolute -bottom-2 left-6 w-4 h-4 bg-surface border-b border-r border-purple/20 rotate-45"
        aria-hidden
      />
    </div>
  )
}
