'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface LighthouseLogoProps {
  src?: string       // path to lighthouse png, default /3dicons/lighthouse.png
  size?: number      // px, applied to both img and svg viewBox
  className?: string
}

export default function LighthouseLogo({
  src = '/3dicons/lighthouse.png',
  size = 96,
  className = '',
}: LighthouseLogoProps) {
  const [brightened, setBrightened] = useState(false)

  // brighten after load + short pause — gives the "powering up" feel
  useEffect(() => {
    const t = setTimeout(() => setBrightened(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // lamp room position — approx top 24% of image, centered
  const lx = size * 0.5
  const ly = size * 0.24

  // ray geometry: narrow at source, wide at tip, extends 1.4× size outward
  const reach   = size * 1.4   // how far the beam extends
  const spread  = size * 0.45  // half-height of beam at its widest

  // left beam polygon points (apex near lamp, fans left)
  const leftPts  = `${lx},${ly} ${lx - 12},${ly - 7} ${lx - reach},${ly - spread} ${lx - reach},${ly + spread} ${lx - 12},${ly + 7}`
  // right beam — mirror
  const rightPts = `${lx},${ly} ${lx + 12},${ly - 7} ${lx + reach},${ly - spread} ${lx + reach},${ly + spread} ${lx + 12},${ly + 7}`

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>

      {/* rays — overflow visible so they extend beyond the image bounds */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: 'absolute', inset: 0,
          width: size, height: size,
          overflow: 'visible',
          zIndex: 0,
        }}
      >
        <defs>
          {/* left: right edge (source) opaque → left edge (tip) transparent */}
          <linearGradient id="lhLeftGrad" x1="1" y1="0.5" x2="0" y2="0.5" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#FFC940" stopOpacity="0.32" />
            <stop offset="75%"  stopColor="#FFC940" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFC940" stopOpacity="0" />
          </linearGradient>
          {/* right: left edge (source) opaque → right edge (tip) transparent */}
          <linearGradient id="lhRightGrad" x1="0" y1="0.5" x2="1" y2="0.5" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#FFC940" stopOpacity="0.32" />
            <stop offset="75%"  stopColor="#FFC940" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#FFC940" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon
          points={leftPts}
          fill="url(#lhLeftGrad)"
          className={`lighthouse-beam${brightened ? ' lighthouse-beam--active' : ''}`}
          style={{ animationDelay: '0.1s' }}
        />
        <polygon
          points={rightPts}
          fill="url(#lhRightGrad)"
          className={`lighthouse-beam${brightened ? ' lighthouse-beam--active' : ''}`}
          style={{ animationDelay: '0.7s' }}
        />
      </svg>

      {/* png — on top, starts dark blue, brightens after delay */}
      <motion.img
        src={src}
        alt="Shipyard lighthouse"
        width={size}
        height={size}
        initial={{ filter: 'brightness(0.15) saturate(0.3) hue-rotate(210deg)' }}
        animate={brightened
          ? { filter: 'brightness(1) saturate(1) hue-rotate(0deg)' }
          : { filter: 'brightness(0.15) saturate(0.3) hue-rotate(210deg)' }
        }
        transition={{ duration: 1.6, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 1, display: 'block' }}
        draggable={false}
      />
    </div>
  )
}
