'use client'

// Village.tsx — R3F Canvas root. All 3D elements live inside here

import { Canvas } from '@react-three/fiber'
import { BUILDINGS } from '@/lib/buildings'
import Island from './Island'
import Camera from './Camera'
import Building from './Building'

export default function Village() {
  return (
    <Canvas
      // Slight upward angle so the island isn't dead-flat on load
      camera={{ position: [0, 18, 32], fov: 50 }}
      shadows
      // Transparent bg — the ink body shows through, no canvas colour flash
      style={{ background: 'transparent' }}
    >
      {/* Soft base fill — prevents fully dark faces on geometry */}
      <ambientLight intensity={0.4} />

      {/* Primary sun — angled to cast visible shadows across the island */}
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Island />
      <Camera />

      {BUILDINGS.map((b) => (
        <Building key={b.id} buildingId={b.id} />
      ))}
    </Canvas>
  )
}
