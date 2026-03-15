'use client'

import type { ReactElement } from 'react'
import '@/styles/GlassIcons.css'

export interface GlassIconsItem {
  icon: ReactElement
  color?: string
  label: string
  customClass?: string
  onClick?: () => void
}

export interface GlassIconsProps {
  items: GlassIconsItem[]
  className?: string
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

export function GlassIconBtn({ icon, label, customClass, onClick }: GlassIconsItem) {
  return (
    <button
      type="button"
      className={`icon-btn ${customClass ?? ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <span className="icon-btn__back" />
      <span className="icon-btn__front">
        <span className="icon-btn__icon" aria-hidden="true">{icon}</span>
      </span>
      <span className="icon-btn__label">{label}</span>
    </button>
  )
}
