'use client'

// water-fill button — <i> element rises from bottom on hover
// wave surface created by two rotating ellipse pseudo-elements in globals.css
// idle: amber water visible in bottom ~45%, cyan glow on hover with full fill
// renders <a> when href provided

interface WaterButtonProps {
  label: string
  onClick?: () => void
  href?: string
  className?: string
}

export default function WaterButton({ label, onClick, href, className = '' }: WaterButtonProps) {
  const inner = (
    <div
      className={`water-btn ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      <span>{label}</span>
      <i />
    </div>
  )

  if (href) return <a href={href} style={{ display: 'inline-block' }}>{inner}</a>
  return inner
}
