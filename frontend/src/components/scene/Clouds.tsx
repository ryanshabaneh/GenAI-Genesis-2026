'use client'

// Clouds.tsx — slowly drifting cloud GLBs at varying heights and positions.

import { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'

const CLOUD_MODELS = [
  '/models/clouds/Cloud_1.glb',
  '/models/clouds/Cloud_2.glb',
  '/models/clouds/Cloud_3.glb',
  '/models/clouds/Cloud_4.glb',
]

// Hardcoded cloud placements — position, scale, drift speed, phase offset
const CLOUD_DEFS = [
  { model: 0, pos: [-55, 32, -20] as [number,number,number], scale: 0.18, speed: 0.9, phase: 0 },
  { model: 1, pos: [ 48, 38,  10] as [number,number,number], scale: 0.22, speed: 0.7, phase: 1.5 },
  { model: 2, pos: [-30, 45, -40] as [number,number,number], scale: 0.14, speed: 1.1, phase: 3.0 },
  { model: 3, pos: [ 30, 36,  40] as [number,number,number], scale: 0.20, speed: 0.8, phase: 0.8 },
  { model: 0, pos: [  5, 50, -55] as [number,number,number], scale: 0.12, speed: 1.3, phase: 2.2 },
  { model: 2, pos: [-50, 28,  30] as [number,number,number], scale: 0.16, speed: 0.6, phase: 4.1 },
]

function CloudMesh({ modelIndex, position, scale, speed, phase }: {
  modelIndex: number
  position: [number, number, number]
  scale: number
  speed: number
  phase: number
}) {
  const { scene } = useGLTF(CLOUD_MODELS[modelIndex])
  const ref = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    // gentle horizontal drift — each cloud on its own sine cycle
    ref.current.position.x = position[0] + Math.sin(clock.getElapsedTime() * speed * 0.1 + phase) * 6
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * speed * 0.07 + phase) * 1.2
  })

  return (
    <primitive
      ref={ref}
      object={scene.clone()}
      position={position}
      scale={[scale, scale, scale]}
    />
  )
}

export default function Clouds() {
  return (
    <>
      {CLOUD_DEFS.map((def, i) => (
        <CloudMesh
          key={i}
          modelIndex={def.model}
          position={def.pos}
          scale={def.scale}
          speed={def.speed}
          phase={def.phase}
        />
      ))}
    </>
  )
}

// Preload all cloud variants
CLOUD_MODELS.forEach((p) => useGLTF.preload(p))
