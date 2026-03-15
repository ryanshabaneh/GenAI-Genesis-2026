'use client'

// VancouverView.tsx
// Vancouver GLB scale diagnosis:
//   Raw GLB units are unknown. We compute the bounding box after load,
//   then derive: scale = TARGET_SPAN / maxDimension
//   TARGET_SPAN = how wide we want the island in world units (set to 40).
//   Camera is then placed at distance = TARGET_SPAN * 1.5 from origin.
//   This makes the math self-consistent regardless of raw GLB scale.

import { useMemo, useRef, useEffect, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OCImpl } from 'three-stdlib'
import Clouds from './Clouds'

const ISLAND_PATH = '/models/vancouver.glb'

// How wide we want the island in Three.js world units
const TARGET_SPAN = 40

function VancouverIsland() {
  const { scene } = useGLTF(ISLAND_PATH)

  const { scale, cx, cy, cz } = useMemo(() => {
    // Compute raw bounding box of the loaded scene graph
    const box = new THREE.Box3().setFromObject(scene)

    // If geometry hasn't loaded yet, box will be empty — guard against it
    if (box.isEmpty()) {
      return { scale: 0.003, cx: 0, cy: 0, cz: 0 }
    }

    const size = new THREE.Vector3()
    box.getSize(size)

    const center = new THREE.Vector3()
    box.getCenter(center)

    // Normalize: largest horizontal dimension → TARGET_SPAN world units
    const rawMaxH = Math.max(size.x, size.z)
    const s = rawMaxH > 0 ? TARGET_SPAN / rawMaxH : 0.003

    // Center offset in world units (after scaling)
    return { scale: s, cx: center.x * s, cy: center.y * s, cz: center.z * s }
  }, [scene])

  return (
    <primitive
      object={scene}
      scale={[scale, scale, scale]}
      // Translate so the island centroid sits at world origin
      position={[-cx, -cy, -cz]}
      receiveShadow
    />
  )
}

useGLTF.preload(ISLAND_PATH)

// Camera math:
//   Island spans TARGET_SPAN units horizontally.
//   Camera height  = TARGET_SPAN * 0.7  → ~28 units up
//   Camera depth   = TARGET_SPAN * 1.1  → ~44 units back
//   Gives elevation angle ≈ atan(0.7/1.1) ≈ 32° — clean isometric read.
const CAM_POS = new THREE.Vector3(0, TARGET_SPAN * 0.7, TARGET_SPAN * 1.1)
const CAM_TARGET = new THREE.Vector3(0, 0, 0)

// Resets camera to the canonical landing-page position every time this mounts.
// Without this, returning from BuildingView leaves OrbitControls in whatever
// state the user left it, making the overview look different from the landing page.
function CameraReset() {
  const { camera } = useThree()
  const controlsRef = useRef<OCImpl>(null)

  useEffect(() => {
    camera.position.copy(CAM_POS)
    if (controlsRef.current) {
      controlsRef.current.target.copy(CAM_TARGET)
      controlsRef.current.update()
    }
  }, [camera])

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={Math.PI / 2.4}
      minDistance={TARGET_SPAN * 0.3}
      maxDistance={TARGET_SPAN * 5}
      target={[0, 0, 0]}
      autoRotate
      autoRotateSpeed={0.4}
    />
  )
}

export default function VancouverView() {
  return (
    <Canvas
      camera={{ position: [CAM_POS.x, CAM_POS.y, CAM_POS.z], fov: 45, near: 0.01, far: 10000 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={1.4} />
      <hemisphereLight args={['#d0eeff', '#c8f082', 0.8]} />
      <directionalLight
        position={[TARGET_SPAN * 0.5, TARGET_SPAN * 0.8, TARGET_SPAN * 0.3]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Suspense fallback={null}>
        <VancouverIsland />
      </Suspense>

      <Suspense fallback={null}>
        <Clouds />
      </Suspense>

      <CameraReset />
    </Canvas>
  )
}
