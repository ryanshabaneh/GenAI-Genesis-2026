'use client'

import React from 'react'
import '@/styles/GlassIcons.css'

export interface GlassIconsItem {
  icon: React.ReactElement
  color: string
  label: string
  customClass?: string
  onClick?: () => void
}

export interface GlassIconsProps {
  items: GlassIconsItem[]
  className?: string
}

// extended to include brand palette
const gradientMapping: Record<string, string> = {
  blue:   'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red:    'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green:  'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))',
  // brand tokens
  cyan:   'linear-gradient(hsl(194, 100%, 45%), hsl(185, 100%, 40%))',
  teal:   'linear-gradient(hsl(169, 55%, 52%), hsl(160, 55%, 42%))',
  amber:  'linear-gradient(hsl(43, 100%, 58%), hsl(35, 100%, 50%))',
}

function getBackground(color: string): React.CSSProperties {
  return gradientMapping[color]
    ? { background: gradientMapping[color] }
    : { background: color }
}

export default function GlassIcons({ items, className }: GlassIconsProps) {
  return (
    <div className={`icon-btns ${className ?? ''}`}>
      {items.map((item, i) => (
        <GlassIconBtn key={i} {...item} />
      ))}
    </div>
  )
}

export function GlassIconBtn({ icon, color, label, customClass, onClick }: GlassIconsItem) {
  return (
    <button
      type="button"
      className={`icon-btn ${customClass ?? ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <span className="icon-btn__back" style={getBackground(color)} />
      <span className="icon-btn__front">
        <span className="icon-btn__icon" aria-hidden="true">{icon}</span>
      </span>
      <span className="icon-btn__label">{label}</span>
    </button>
  )
}
