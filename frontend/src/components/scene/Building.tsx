'use client'

// components/scene/Building.tsx
// Renders a single building in the 3D scene as a colored box.
// Visual appearance (color, scale, opacity, glow) is driven entirely by the
// building's current score stage — so the scene updates automatically as
// WebSocket events arrive. Clicking the mesh opens the building's panel.
//
// Note: GLB models (modelPath in BUILDINGS config) are not loaded yet —
// this uses a colored boxGeometry as a placeholder for the hackathon.

import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { percentToStage, STAGE_CONFIG } from '@/lib/stages'
import type { BuildingId } from '@/types'

// Maps stages to design token hex values.
// foundation = fog (empty), frame/halfBuilt/almostDone = amber (in-progress), complete = teal.
// Scanning overrides all of these with cyan — checked before this lookup.
const STAGE_COLORS: Record<string, string> = {
  foundation: '#6B7A94', // --fog
  frame:      '#4A78D4', // --blue
  halfBuilt:  '#4A78D4', // --blue
  almostDone: '#4A78D4', // --blue
  complete:   '#3ECFB2', // --teal
}

interface BuildingProps {
  buildingId: BuildingId
}

export default function Building({ buildingId }: BuildingProps) {
  const buildingState = useStore((s) => s.buildings[buildingId])
  const setActiveBuilding = useStore((s) => s.setActiveBuilding)
  const config = BUILDINGS.find((b) => b.id === buildingId)

  if (!config) return null

  const isScanning = buildingState.status === 'scanning'
  const stage = percentToStage(buildingState.percent)
  const stageConfig = STAGE_CONFIG[stage]
  // Cyan overrides all stage colors while a building is actively being scanned
  const color = isScanning ? '#00D4FF' : STAGE_COLORS[stage]

  // Box height scales with stage — shrink the geometry itself rather than just
  // scaling the mesh so the base stays flush with the island surface
  const boxHeight = 2 * stageConfig.scale
  const [x, , z] = config.position
  // Raise box so it sits on the island surface
  const y = (boxHeight / 2) + 0.05

  return (
    <mesh
      position={[x, y, z]}
      scale={[stageConfig.scale, stageConfig.scale, stageConfig.scale]}
      castShadow
      // Clicking a building opens its detail panel in the right column
      onClick={() => setActiveBuilding(buildingId)}
    >
      <boxGeometry args={[3, 2, 3]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={stageConfig.opacity}
        // Emissive makes complete buildings glow — visible even under shadow
        emissive={color}
        emissiveIntensity={stageConfig.emissiveIntensity}
      />
    </mesh>
  )
}
