'use client'

import type { ReactNode, CSSProperties } from 'react'
import '@/styles/WaveCard.css'

interface WaveProps {
  colorOne?: string
  colorTwo?: string
  colorThree?: string
  speed?: number
  opacity?: number
}

interface WaveBlobsProps extends WaveProps {}

interface WaveCardProps extends WaveProps {
  children: ReactNode
  radius?: number
  className?: string
  style?: CSSProperties
}

export function WaveBlobs({
  colorOne = '#A78BFA',
  colorTwo = '#4A78D4',
  colorThree = '#00D4FF',
  speed = 10,
  opacity = 0.45,
}: WaveBlobsProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        '--wave-color-one':   colorOne,
        '--wave-color-two':   colorTwo,
        '--wave-color-three': colorThree,
        '--wave-speed':       `${speed}s`,
        '--wave-opacity':     String(opacity),
      } as CSSProperties}
    >
      <div className="wave-card__blob" />
      <div className="wave-card__blob" />
      <div className="wave-card__blob" />
    </div>
  )
}

export default function WaveCard({
  children,
  colorOne = '#A78BFA',
  colorTwo = '#4A78D4',
  colorThree = '#00D4FF',
  speed = 10,
  opacity = 0.45,
  radius = 16,
  className = '',
  style,
}: WaveCardProps) {
  return (
    <div
      className={`wave-card ${className}`}
      style={{
        '--wave-color-one':   colorOne,
        '--wave-color-two':   colorTwo,
        '--wave-color-three': colorThree,
        '--wave-speed':       `${speed}s`,
        '--wave-opacity':     String(opacity),
        '--wc-radius':        `${radius}px`,
        ...style,
      } as CSSProperties}
    >
      <div className="wave-card__blob" />
      <div className="wave-card__blob" />
      <div className="wave-card__blob" />
      <div className="wave-card__content">
        {children}
      </div>
    </div>
  )
}
