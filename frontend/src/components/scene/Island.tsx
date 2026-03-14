'use client'

// components/scene/Island.tsx
// The flat green ground plane that all buildings sit on.
// It's a simple Three.js plane mesh — no logic, just geometry and material.
// receiveShadow makes the island catch building shadows from the directional light.

import * as THREE from 'three'

export default function Island() {
  return (
    <mesh
      // Rotate 90° around X so the plane faces up (Three.js planes default to facing forward)
      rotation={[-Math.PI / 2, 0, 0]}
      // Slight negative Y offset keeps the island from z-fighting with buildings at y=0
      position={[0, -0.05, 0]}
      receiveShadow
    >
      <planeGeometry args={[60, 60]} />
      {/* muted dark green — matches ink-heavy UI rather than bright tailwind green */}
      <meshLambertMaterial color="#1E3320" />
    </mesh>
  )
}
