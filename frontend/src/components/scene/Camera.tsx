'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStore } from '@/store/useStore'
import { getBuildingConfig } from '@/lib/buildings'

const DEFAULT_POS    = new Vector3(0, 38, 58)
const DEFAULT_TARGET = new Vector3(0, 1,  0)

export default function CameraController() {
  const { camera } = useThree()
  const controls   = useRef<OrbitControlsImpl>(null)

  const activeBuilding = useStore((s) => s.activeBuilding)

  const goalPos    = useRef(DEFAULT_POS.clone())
  const goalTarget = useRef(DEFAULT_TARGET.clone())

  useEffect(() => {
    if (activeBuilding) {
      const [bx, , bz] = getBuildingConfig(activeBuilding).position
      goalPos.current.set(bx + 1, 12, bz + 18)
      goalTarget.current.set(bx, 0.5, bz)
    } else {
      goalPos.current.copy(DEFAULT_POS)
      goalTarget.current.copy(DEFAULT_TARGET)
    }
  }, [activeBuilding])

  useFrame((_, delta) => {
    // frame-rate independent lerp — smooth zoom regardless of fps
    const t = 1 - Math.pow(0.012, delta)
    camera.position.lerp(goalPos.current, t)
    if (controls.current) {
      controls.current.target.lerp(goalTarget.current, t)
      controls.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controls}
      maxPolarAngle={Math.PI / 2.6}
      minDistance={8}
      maxDistance={100}
    />
  )
}
