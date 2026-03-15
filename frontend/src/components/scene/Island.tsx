'use client'

// components/scene/Island.tsx
// Polygon grass island + surrounding water — Animal Crossing style.
// Canvas textures are generated client-side (Village uses ssr: false).

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function makeGrassTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // base light pastel green
  ctx.fillStyle = '#C8F082'
  ctx.fillRect(0, 0, size, size)

  // blade-like variation — lighter and darker streaks
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const light = Math.random() > 0.5
    ctx.fillStyle = light
      ? `rgba(210,255,130,${(Math.random() * 0.3 + 0.1).toFixed(2)})`
      : `rgba(150,220,60,${(Math.random() * 0.25 + 0.08).toFixed(2)})`
    ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 5 + 2)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 6)
  return tex
}

function makeWaterTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#5CE8E0'
  ctx.fillRect(0, 0, size, size)

  // subtle ripple lines
  for (let i = 0; i < 24; i++) {
    const y = Math.random() * size
    ctx.strokeStyle = `rgba(255,255,255,${(Math.random() * 0.18 + 0.08).toFixed(2)})`
    ctx.lineWidth = Math.random() * 1.5 + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(size * 0.3, y - 8, size * 0.7, y + 8, size, y)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(5, 5)
  return tex
}

function Water() {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const tex = useMemo(() => makeWaterTexture(), [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    tex.offset.x = t * 0.018
    tex.offset.y = t * 0.012
    tex.needsUpdate = true
  })

  return (
    // 10-sided polygon water — slightly larger than the grass circle, sits below
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <circleGeometry args={[40, 10]} />
      <meshStandardMaterial
        ref={matRef}
        map={tex}
        color="#5CE8E0"
        transparent
        opacity={0.88}
        roughness={0.08}
        metalness={0.18}
      />
    </mesh>
  )
}

export default function Island() {
  const grassTex = useMemo(() => makeGrassTexture(), [])

  return (
    <group>
      {/* grass — 12-sided polygon, Duolingo green, textured */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 12]} />
        <meshStandardMaterial
          map={grassTex}
          color="#C8F082"
          roughness={0.88}
          metalness={0.0}
        />
      </mesh>

      <Water />
    </group>
  )
}
