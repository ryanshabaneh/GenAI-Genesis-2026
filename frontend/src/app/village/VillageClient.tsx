'use client'

// app/village/VillageClient.tsx
// Client wrapper for the village page — provides socket + auth context.
// This is a stub connection: the full scan flow lives on the home page (/),
// but if users navigate here directly the store and socket are still wired up.
// To route the full scan flow here later, move SocketProvider + useScan to a layout.

import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { SocketProvider } from '@/contexts/SocketContext'
import BuildingPanel from '@/components/ui/BuildingPanel'
import ScanProgress from '@/components/ui/ScanProgress'
import CityStub from '@/components/scene/CityStub'

const VillageScene = dynamic(() => import('@/components/scene/Village'), {
  ssr: false,
  loading: () => <CityStub />,
})

export default function VillageClient() {
  useAuth() // hydrates githubUser from session on direct navigation

  return (
    <SocketProvider>
      <main className="flex h-screen w-screen overflow-hidden">
        {/* Scene — left 60% */}
        <div className="relative" style={{ width: '60%' }}>
          <VillageScene />
        </div>

        {/* Panel — right 40% */}
        <div className="flex flex-col border-l border-gray-800 bg-gray-900" style={{ width: '40%' }}>
          <BuildingPanel />
        </div>

        {/* Full-screen overlay while scanning */}
        <ScanProgress />
      </main>
    </SocketProvider>
  )
}
