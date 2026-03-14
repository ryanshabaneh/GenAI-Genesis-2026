'use client'

// components/scene/Camera.tsx
// Configures orbit camera constraints for the 3D scene.
// maxPolarAngle prevents the camera from going below the island surface.
// minDistance/maxDistance keep the view useful — close enough to see buildings,
// far enough to see the whole village.
// Note: OrbitControls is also added in Village.tsx — this component exists
// to isolate camera config as a separate concern if we need to extend it later.

import { OrbitControls } from '@react-three/drei'

export default function Camera() {
  return (
    <OrbitControls
      // ~82° max — prevents flipping underground
      maxPolarAngle={Math.PI / 2.2}
      minDistance={10}
      maxDistance={60}
      target={[0, 0, 0]}
    />
  )
}
