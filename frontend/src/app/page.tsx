'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import LoginOverlay from '@/components/ui/LoginOverlay'
import RepoPickerOverlay from '@/components/ui/RepoPickerOverlay'
import { GitHubAuthButton } from '@/components/ui/AuthButton'
import ScoreBar from '@/components/ui/ScoreBar'
import BuildingPanel from '@/components/ui/BuildingPanel'
import ScanProgress from '@/components/ui/ScanProgress'

import { useSocket } from '@/hooks/useSocket'
import CityStub from '@/components/scene/CityStub'

const VillageScene = dynamic(() => import('@/components/scene/Village'), {
  ssr: false,
  loading: () => <CityStub />,
})

export default function HomePage() {
  useAuth() // hydrates githubUser into store on mount
  useSocket() // keep socket alive for the entire page lifecycle

  const githubUser = useStore((s) => s.githubUser)
  const scanStatus = useStore((s) => s.scanStatus)

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-ink">
      {/* City — always in background */}
      <div className="absolute inset-0">
        <VillageScene />
      </div>

      {/* Overlays — everything floats over the city */}
      {!githubUser && (
        <Suspense fallback={null}>
          <LoginOverlay />
        </Suspense>
      )}

      {githubUser && (scanStatus === 'idle' || scanStatus === 'error') && (
        <RepoPickerOverlay scanError={scanStatus === 'error'} />
      )}

      {githubUser && scanStatus !== 'idle' && scanStatus !== 'error' && (
        <>
          <div className="absolute top-4 right-4 z-10">
            <GitHubAuthButton />
          </div>
          <ScoreBar />
          <BuildingPanel />
          {scanStatus === 'scanning' && <ScanProgress />}
        </>
      )}
    </main>
  )
}
