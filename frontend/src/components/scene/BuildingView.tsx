'use client'

// BuildingView.tsx — isolated detail scene for a single building.
// GLB is auto-normalized via bounding box to TARGET_HEIGHT units tall.
// Camera is auto-positioned based on normalized size.

import { useMemo, useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OCImpl } from 'three-stdlib'
import { getBuildingConfig } from '@/lib/buildings'
import type { BuildingId } from '@/types'

// All buildings normalize to this height in world units.
// Camera math below is derived from this constant.
const TARGET_H = 6

function NormalizedBuilding({ path, accentColor }: { path: string; accentColor: string }) {
  const { scene } = useGLTF(path)

  const [cloned, scale, yFloor] = useMemo(() => {
    const c = scene.clone(true)

    // Propagate all transforms so nested geometry reads correct world positions.
    // Large pack models (Factory.glb etc.) nest meshes under Object3D groups
    // with non-identity matrices — without this, setFromObject returns wrong bounds.
    c.updateMatrixWorld(true)

    // Expand box mesh-by-mesh using world-space positions for maximum accuracy.
    const box = new THREE.Box3()
    const pos = new THREE.Vector3()
    c.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || !mesh.geometry) return
      const geo = mesh.geometry
      const attr = geo.attributes.position
      if (!attr) return
      for (let i = 0; i < attr.count; i++) {
        pos.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld)
        box.expandByPoint(pos)
      }
    })

    // Guard: degenerate / empty model
    if (box.isEmpty()) return [c, 1, 0]

    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const s = maxDim > 0 ? TARGET_H / maxDim : 1

    // Shift so the model's lowest world point sits flush at y = 0
    const yOff = -box.min.y * s

    // Light accent emissive so building colour is visible without blowing out textures
    c.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial
        mat.emissive = new THREE.Color(accentColor)
        mat.emissiveIntensity = 0.06
        mat.needsUpdate = true
      })
    })

    return [c, s, yOff]
  }, [scene, accentColor])

  return <primitive object={cloned} scale={[scale, scale, scale]} position={[0, yFloor, 0]} />
}

// Positions the camera once after the model loads.
// All math anchored to TARGET_H so every building gets the same framing.
// Derived angle: camera at (h*0.85, h*1.35, h*1.55) looking at (0, h*0.38, 0)
// gives ≈ 30° elevation — a clean isometric-ish read.
function AutoCamera({ modelPath }: { modelPath: string }) {
  const { camera } = useThree()
  const controlsRef = useRef<OCImpl>(null)

  useEffect(() => {
    const h = TARGET_H
    camera.position.set(h * 0.85, h * 1.35, h * 1.55)
    const target = new THREE.Vector3(0, h * 0.38, 0)
    if (controlsRef.current) {
      controlsRef.current.target.copy(target)
      controlsRef.current.update()
    }
  }, [modelPath, camera])

  return (
    <OrbitControls
      ref={controlsRef}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={4}
      maxDistance={40}
      autoRotate
      autoRotateSpeed={1.2}
    />
  )
}

export default function BuildingView({ buildingId }: { buildingId: BuildingId }) {
  const config = getBuildingConfig(buildingId)

  return (
    <Canvas
      camera={{ position: [5, 8, 9], fov: 45, near: 0.1, far: 500 }}
      shadows
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={1.3} />
      <hemisphereLight args={['#d0eeff', '#c8f082', 0.7]} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Ground — same AC green as the island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[18, 32]} />
        <meshStandardMaterial color="#C8F082" roughness={0.9} />
      </mesh>

      <NormalizedBuilding path={config.modelPath} accentColor={config.theme.primary} />

      <AutoCamera modelPath={config.modelPath} />
    </Canvas>
  )
}
