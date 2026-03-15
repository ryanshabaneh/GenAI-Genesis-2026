'use client'

// transparent overlay that defines the three HUD zones.

import TopNav from './TopNav'
import BottomBar from './BottomBar'
import type { ReactNode } from 'react'

// shared layout constant, single source of truth for all zone sizing
export const HUD = {
  navH:        70,   
  panelW:      '24rem',
  panelRight:  'max(16px, 2vw)',
  panelGapTop: 12,   
  panelGapBot: 16,   
  barH:        52,   
} as const

// derived bottom of right panel
const panelBottom = `calc(${HUD.barH}px + ${HUD.panelGapBot}px)`
// top of right panel
const panelTop    = `calc(${HUD.navH}px + ${HUD.panelGapTop}px)`
// right edge of dialogue bar — stops before right panel column
const barRight    = `calc(${HUD.panelW} + ${HUD.panelRight} + 16px)`

interface HUDLayoutProps {
  rightPanel: ReactNode
}

export default function HUDLayout({ rightPanel }: HUDLayoutProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">

      <div className="absolute top-0 left-0 right-0 pointer-events-auto" style={{ height: HUD.navH }}>
        <TopNav />
      </div>
      <div
        className="absolute pointer-events-auto"
        style={{
          top:    panelTop,
          bottom: panelBottom,
          right:  HUD.panelRight,
          width:  HUD.panelW,
        }}
      >
        {rightPanel}
      </div>

      <div
        className="absolute bottom-0 left-0 pointer-events-auto"
        style={{
          height: HUD.barH,
          right:  barRight,
        }}
      >
        <BottomBar />
      </div>

    </div>
  )
}
