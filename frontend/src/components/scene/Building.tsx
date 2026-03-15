'use client'

import { useMemo, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/store/useStore'
import { BUILDINGS } from '@/lib/buildings'
import { percentToStage, STAGE_CONFIG } from '@/lib/stages'
import type { BuildingId } from '@/types'

// ─── model swap ──────────────────────────────────────────────────────────────
// flip to false to go back to placeholder boxes
const USE_MODELS = true
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  foundation: '#6B7A94',
  frame:      '#4A78D4',
  halfBuilt:  '#4A78D4',
  almostDone: '#4A78D4',
  complete:   '#3ECFB2',
}

// placeholder box — used when USE_MODELS = false
function BuildingBox({ color, stageConfig }: {
  color: string
  stageConfig: typeof STAGE_CONFIG[keyof typeof STAGE_CONFIG]
}) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[3, 2, 3]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={stageConfig.opacity}
          emissive={color}
          emissiveIntensity={stageConfig.emissiveIntensity}
          wireframe={stageConfig.wireframe}
          roughness={stageConfig.roughness}
          metalness={stageConfig.metalness}
        />
      </mesh>

      {/* scaffolding wireframe overlay — frame + halfBuilt only */}
      {stageConfig.scaffolding && (
        <mesh>
          <boxGeometry args={[3.06, 2.06, 3.06]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  )
}

// GLB model — cloned once via useMemo, material tint updated via useEffect
function BuildingGLB({ path, color, stageConfig, modelScale = 1 }: {
  path: string
  color: string
  stageConfig: typeof STAGE_CONFIG[keyof typeof STAGE_CONFIG]
  modelScale?: number
}) {
  const { scene } = useGLTF(path)

  // Clone once per path so instances are independent and don't re-clone on re-render
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Apply stage tint/opacity whenever stage or color changes — not on every frame
  useEffect(() => {
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial
        mat.transparent = stageConfig.opacity < 1
        mat.opacity = stageConfig.opacity
        mat.emissive = new THREE.Color(color)
        mat.emissiveIntensity = stageConfig.emissiveIntensity
        mat.wireframe = stageConfig.wireframe
        mat.needsUpdate = true
      })
    })
  }, [cloned, color, stageConfig])

  const s = modelScale
  return <primitive object={cloned} scale={[s, s, s]} />
}

export default function Building({ buildingId }: { buildingId: BuildingId }) {
  const buildingState     = useStore((s) => s.buildings[buildingId])
  const scanStatus        = useStore((s) => s.scanStatus)
  const setActiveBuilding = useStore((s) => s.setActiveBuilding)
  const config            = BUILDINGS.find((b) => b.id === buildingId)

  if (!config) return null

  const isScanning  = buildingState.status === 'scanning'
  const stage       = percentToStage(buildingState.percent)
  const stageConfig = STAGE_CONFIG[stage]
  const color       = isScanning ? '#00D4FF' : STAGE_COLORS[stage]

  const [x, , z] = config.position
  const y         = stageConfig.scale + 0.05  // base flush with island

  // TODO: flip BUILDING_GUARD_ENABLED to true to re-enable scan gate
  const BUILDING_GUARD_ENABLED = false
  const canClick = !BUILDING_GUARD_ENABLED || (scanStatus !== 'idle' && scanStatus !== 'error')

  return (
    <group
      position={[x, y, z]}
      scale={[stageConfig.scale, stageConfig.scale, stageConfig.scale]}
      onClick={canClick ? () => setActiveBuilding(buildingId) : undefined}
    >
      {USE_MODELS
        ? <BuildingGLB path={config.modelPath} color={color} stageConfig={stageConfig} modelScale={config.modelScale} />
        : <BuildingBox color={color} stageConfig={stageConfig} />
      }
    </group>
  )
}

// Preload all GLB models at module load time to avoid pop-in
BUILDINGS.forEach((b) => useGLTF.preload(b.modelPath))
