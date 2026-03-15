'use client'

import type { ReactNode, CSSProperties } from 'react'
import '@/styles/GlowFrame.css'

interface GlowFrameProps {
  children: ReactNode
  c1?: string
  c2?: string
  borderWidth?: number
  radius?: number
  variant?: 'animated' | 'pulse' | 'static'
  speed?: number
  className?: string
  style?: CSSProperties
}

export default function GlowFrame({
  children,
  c1 = '#A78BFA',
  c2 = '#00D4FF',
  borderWidth = 2,
  radius = 18,
  variant = 'pulse',
  speed = 4,
  className = '',
  style,
}: GlowFrameProps) {
  const variantClass =
    variant === 'animated' ? 'glow-frame--animated' :
    variant === 'pulse'    ? 'glow-frame--pulse'    : ''

  return (
    <div
      className={`glow-frame ${variantClass} ${className}`}
      style={{
        '--gf-c1':     c1,
        '--gf-c2':     c2,
        '--gf-width':  `${borderWidth}px`,
        '--gf-radius': `${radius}px`,
        '--gf-speed':  `${speed}s`,
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}
