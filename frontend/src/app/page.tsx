'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import LoginOverlay from '@/components/ui/LoginOverlay'
import RepoPickerOverlay from '@/components/ui/RepoPickerOverlay'
import ScanProgress from '@/components/ui/ScanProgress'
import HUDLayout from '@/components/layout/HUDLayout'
import BuildingPanel from '@/components/ui/BuildingPanel'
import GlowFrame from '@/components/ui/GlowFrame'
import CityOverview from '@/components/ui/CityOverview'
import CityStub from '@/components/scene/CityStub'
import { getBuildingConfig } from '@/lib/buildings'
import { SocketProvider } from '@/contexts/SocketContext'

const VillageScene = dynamic(() => import('@/components/scene/Village'), {
  ssr: false,
  loading: () => <CityStub />,
})

export default function HomePage() {
  useAuth()

  const githubUser  = useStore((s) => s.githubUser)
  const scanStatus  = useStore((s) => s.scanStatus)
  const activeBuilding = useStore((s) => s.activeBuilding)

  const isInSession = githubUser && scanStatus !== 'idle' && scanStatus !== 'error'

  const buildingTheme = activeBuilding ? getBuildingConfig(activeBuilding).theme : null
  const rightPanel = !isInSession ? null : activeBuilding ? (
    <GlowFrame
      c1={buildingTheme!.gradient.from}
      c2={buildingTheme!.gradient.to}
      radius={18}
      borderWidth={2}
      variant="pulse"
      speed={3}
      className="w-full h-full"
    >
      <BuildingPanel />
    </GlowFrame>
  ) : (
    <GlowFrame
      c1="#A78BFA"
      c2="#00D4FF"
      radius={18}
      borderWidth={2}
      variant="pulse"
      speed={5}
      className="w-full h-full"
    >
      <CityOverview />
    </GlowFrame>
  )

  return (
    <SocketProvider>
      <main className="relative w-screen h-screen overflow-hidden bg-ink">

        <div className="absolute inset-0">
          <VillageScene />
        </div>

        {/* ── Auth overlays ── */}
        {!githubUser && (
          <Suspense fallback={null}>
            <LoginOverlay />
          </Suspense>
        )}

        {githubUser && (scanStatus === 'idle' || scanStatus === 'error') && (
          <RepoPickerOverlay scanError={scanStatus === 'error'} />
        )}

        {isInSession && (
          <HUDLayout rightPanel={rightPanel} />
        )}

        {isInSession && scanStatus === 'scanning' && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <ScanProgress />
          </div>
        )}

      </main>
    </SocketProvider>
  )
}
