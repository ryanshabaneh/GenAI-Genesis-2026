// app/village/page.tsx
// Main gameplay page. Splits the screen into two columns:
//   Left 60%  — Three.js village scene with ScoreBar overlay
//   Right 40% — BuildingPanel (tasks + agent chat) for the selected building
// ScanProgress renders as a full-screen overlay on top of both while scanning.
//
// VillageScene uses dynamic import with ssr:false because React Three Fiber
// accesses browser APIs (WebGL, ResizeObserver) that don't exist in Node.

import dynamic from 'next/dynamic'
import BuildingPanel from '@/components/ui/BuildingPanel'
import ScanProgress from '@/components/ui/ScanProgress'
import ScoreBar from '@/components/ui/ScoreBar'

// R3F requires client-only rendering — ssr must be false
const VillageScene = dynamic(() => import('@/components/scene/Village'), { ssr: false })

export default function VillagePage() {
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      {/* Scene — left 60% */}
      <div className="relative" style={{ width: '60%' }}>
        <VillageScene />
        {/* ScoreBar sits over the canvas, anchored to the bottom of the scene column */}
        <div className="absolute bottom-4 left-4 right-4">
          <ScoreBar />
        </div>
      </div>

      {/* Panel — right 40% */}
      <div className="flex flex-col border-l border-gray-800 bg-gray-900" style={{ width: '40%' }}>
        <BuildingPanel />
      </div>

      {/* Full-screen overlay while scanning */}
      <ScanProgress />
    </main>
  )
}
