'use client'

// Village.tsx — view orchestrator.
// activeBuilding === null  →  VancouverView (island overview)
// activeBuilding !== null  →  BuildingView  (isolated building detail)
// Transition driven by AnimatePresence; navigation driven by side panel only.

import { Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useStore } from '@/store/useStore'
import CityStub from './CityStub'

const VancouverView = dynamic(() => import('./VancouverView'), {
  ssr: false,
  loading: () => <CityStub />,
})

const BuildingView = dynamic(() => import('./BuildingView'), {
  ssr: false,
  loading: () => null,
})

export default function Village() {
  const activeBuilding = useStore((s) => s.activeBuilding)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <AnimatePresence mode="wait">
        {!activeBuilding ? (
          <motion.div
            key="vancouver"
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            <Suspense fallback={<CityStub />}>
              <VancouverView />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key={`building-${activeBuilding}`}
            style={{ position: 'absolute', inset: 0 }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={null}>
              <BuildingView buildingId={activeBuilding} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
