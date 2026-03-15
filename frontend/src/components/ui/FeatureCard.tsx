'use client'

import type { CSSProperties } from 'react'
import '@/styles/FeatureCard.css'

interface FeatureCardProps {
  icon: string
  iconAlt?: string
  title: string
  body: string
  colorOne?: string
  colorTwo?: string
  glowColor?: string
  className?: string
}

export default function FeatureCard({
  icon,
  iconAlt = '',
  title,
  body,
  colorOne = '#A78BFA',
  colorTwo = '#00D4FF',
  glowColor,
  className = '',
}: FeatureCardProps) {
  const resolvedGlow = glowColor ?? `${colorOne}59`

  return (
    <div
      className={`feature-card ${className}`}
      style={{
        '--feature-color-one':  colorOne,
        '--feature-color-two':  colorTwo,
        '--feature-glow-color': resolvedGlow,
      } as CSSProperties}
    >
      <div className="feature-card__icon">
        <div className="feature-card__icon-glow" />
        <img src={icon} alt={iconAlt} draggable={false} />
      </div>
      <p className="feature-card__title">{title}</p>
      <p className="feature-card__body">{body}</p>
    </div>
  )
}
