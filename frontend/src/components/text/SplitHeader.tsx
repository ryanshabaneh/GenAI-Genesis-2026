'use client'

// split header — words slide from opposite sides, letters vary weight on hover
// slide: word-level motion.span (x transform)
// VariableProximity: letter-level fontVariationSettings — independent of slide
// accentGradient (default true): right word uses animated teal→cyan gradient text
// when false: falls back to solid accentColor + glow textShadow

import { useRef } from 'react'
import { motion } from 'framer-motion'
import VariableProximity from './VariableProximity'

interface SplitHeaderProps {
  left: string
  right: string
  accentColor?: string
  accentGradient?: boolean
  className?: string
}

const slide = (dir: 1 | -1) => ({
  initial:    { x: `${dir * 140}%`, opacity: 0 },
  animate:    { x: '0%', opacity: 1 },
  transition: { type: 'spring' as const, stiffness: 280, damping: 22, delay: 0.08 },
})

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
      className={`flex items-baseline justify-center overflow-hidden ${className}`}
      style={{
        fontFamily: "'Iosevka Charon Mono', sans-serif",
        // smaller than before — subheader + button sit closer to it in hierarchy
        fontSize: 'clamp(2rem, 5.5vw, 4rem)',
        lineHeight: 1,
      }}
    >
      {/* left word: white, slides from left — starts at 500 (solid), goes to 700 on hover */}
      <motion.span
        {...slide(-1)}
        className="text-white uppercase tracking-tight"
      >
        <VariableProximity
          label={left}
          containerRef={containerRef as React.RefObject<HTMLElement>}
          fromFontVariationSettings="'wght' 500"
          toFontVariationSettings="'wght' 700"
          falloff="gaussian"
          radius={120}
        />
      </motion.span>

      {/* right word: gradient, wider tracking, starts light (200) — distinct from Ship */}
      <motion.span
        {...slide(1)}
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
      </motion.span>
    </div>
  )
}
