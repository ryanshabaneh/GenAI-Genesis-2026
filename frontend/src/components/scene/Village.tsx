'use client'

// components/scene/Village.tsx
// Root React Three Fiber canvas. Sets up the 3D scene environment:
// lights, the island ground plane, all buildings, camera controls.
// Every child component here is a Three.js object — not DOM.
// This component is dynamically imported in village/page.tsx with ssr:false.

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Island from './Island'
import Building from './Building'
import Camera from './Camera'
import { BUILDINGS } from '@/lib/buildings'

export default function Village() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      // Starting camera position gives an isometric-ish overview of the whole island
      camera={{ position: [0, 30, 40], fov: 50 }}
      shadows
    >
      {/* Ambient fills shadows so nothing is pitch black */}
      <ambientLight intensity={0.6} />
      {/* Directional light simulates sunlight and casts building shadows onto the island */}
      <directionalLight
        position={[20, 40, 20]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Island />

      {/* One Building mesh per BUILDINGS config entry — each reads its own store slice */}
      {BUILDINGS.map((config) => (
        <Building key={config.id} buildingId={config.id} />
      ))}

      <Camera />
      {/* OrbitControls — duplicated from Camera.tsx; the Camera component owns these constraints */}
      <OrbitControls
        maxPolarAngle={Math.PI / 2.2}
        minDistance={10}
        maxDistance={60}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
