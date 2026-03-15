'use client'

import { useRef } from 'react'
import VariableProximity from './VariableProximity'

interface SplitHeaderProps {
  left: string
  right: string
  accentColor?: string
  accentGradient?: boolean
  className?: string
}

export default function SplitHeader({
  left,
  right,
  accentColor = 'var(--teal)',
  accentGradient = true,
  className = '',
}: SplitHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className={`flex items-baseline justify-center ${className}`}
      style={{
        fontFamily: "'Iosevka Charon Mono', sans-serif",
        fontSize: 'clamp(2.8rem, 6vw, 4.5rem)',
        lineHeight: 1,
        animation: 'wordmark-fade 0.5s ease both',
      }}
    >
      <span className="text-white uppercase tracking-tight">
        <VariableProximity
          label={left}
          containerRef={containerRef as React.RefObject<HTMLElement>}
          fromFontVariationSettings="'wght' 300"
          toFontVariationSettings="'wght' 600"
          falloff="gaussian"
          radius={120}
        />
      </span>

      <span
        className={`uppercase ml-[0.18em] ${accentGradient ? 'gradient-shift-text' : ''}`}
        style={{
          letterSpacing: '0.1em',
          ...(accentGradient ? {} : {
            color: accentColor,
            textShadow: `0 0 40px ${accentColor}55, 0 0 80px ${accentColor}22`,
          }),
        }}
      >
        <VariableProximity
          label={right}
          containerRef={containerRef as React.RefObject<HTMLElement>}
          fromFontVariationSettings="'wght' 200"
          toFontVariationSettings="'wght' 600"
          falloff="gaussian"
          radius={120}
        />
      </span>
    </div>
  )
}
