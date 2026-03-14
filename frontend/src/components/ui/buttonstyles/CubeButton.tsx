'use client'

// 3D cube button — 4 identical faces rotate on hover (360deg perspective flip)
// all visual styles in globals.css (.cube-btn, .cube-btn__face)
// renders <a> when href is provided, <div role="button"> otherwise

interface CubeButtonProps {
  label: string
  onClick?: () => void
  href?: string
  width?: number | string   // px or CSS string (e.g. 'clamp(180px, 28vw, 240px)')
  height?: number | string
  className?: string
}

export default function CubeButton({
  label,
  onClick,
  href,
  width = 200,
  height = 52,
  className = '',
}: CubeButtonProps) {
  const faces = (
    <div
      className={`cube-btn ${className}`}
      style={{ width, height }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      {[0, 1, 2, 3].map(i => (
        <span key={i} className="cube-btn__face">{label}</span>
      ))}
    </div>
  )

  if (href) return <a href={href} style={{ display: 'inline-block' }}>{faces}</a>
  return faces
}
