'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import LoginOverlay from '@/components/ui/LoginOverlay'
import RepoPickerOverlay from '@/components/ui/RepoPickerOverlay'
import ScanProgress from '@/components/ui/ScanProgress'
import HUDLayout from '@/components/layout/HUDLayout'
import BuildingPanel from '@/components/ui/BuildingPanel'
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
    <BuildingPanel />
  ) : (
    <CityOverview />
  )

  return (
    <SocketProvider>
      <main className="relative w-screen h-screen overflow-hidden bg-ink">

        <div className="absolute inset-0">
          <VillageScene />
        </div>

        <AnimatePresence>
          {!githubUser && (
            <motion.div key="login" className="absolute inset-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}>
              <Suspense fallback={null}><LoginOverlay /></Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {githubUser && (scanStatus === 'idle' || scanStatus === 'error') && (
            <motion.div key="repo-picker" className="absolute inset-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}>
              <RepoPickerOverlay scanError={scanStatus === 'error'} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isInSession && (
            <motion.div key="hud" className="absolute inset-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}>
              <HUDLayout rightPanel={rightPanel} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isInSession && scanStatus === 'scanning' && (
            <motion.div key="scan" className="absolute inset-0 z-30 pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}>
              <ScanProgress />
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </SocketProvider>
  )
}
