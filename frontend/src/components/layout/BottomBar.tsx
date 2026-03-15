'use client'

// BottomBar — collapsed game-style dialogue bar at the bottom.
// Slides up on trigger (task click, fix/evaluate, agent push, user command).
// Does NOT overlap the right panel column — HUDLayout constrains its right edge.
//
// TODO: StageMarker    — sits above dialogue, animates up smoothly on trigger
// TODO: DialogueBar    — AgentMessage + QuickReplyChips + CommandInput
// TODO: collapsed handle — thin visible strip with subtle indicator when closed

export default function BottomBar() {
  return (
    <div
      className="w-full h-full flex items-center px-4"
      style={{
        background:    'rgba(9,12,18,0.70)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop:     '1px solid rgba(255,255,255,0.06)',
        boxShadow:     '0 -1px 0 rgba(255,255,255,0.03), 0 -8px 32px rgba(0,0,0,0.35)',
      }}
    >
    </div>
  )
}
