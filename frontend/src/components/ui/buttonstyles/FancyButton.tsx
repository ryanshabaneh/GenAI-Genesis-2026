'use client'

// SVG double-ring border button — outer + inner rect stroke animate on hover
// stroke-dashoffset: draws the border ring around the pill shape on hover
// perimeter ≈ 680px for a 292x72 pill rect — set as dasharray

interface FancyButtonProps {
  label: string
  onClick?: () => void
  href?: string
  outerColor?: string   // default: amber
  innerColor?: string   // default: teal
  className?: string
}

export default function FancyButton({
  label,
  onClick,
  href,
  outerColor = 'var(--blue)',
  innerColor = 'var(--teal)',
  className = '',
}: FancyButtonProps) {
  const content = (
    <div
      className={`fancy-btn ${className}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
    >
      <svg
        className="fancy-btn__svg"
        width="200"
        height="50"
        viewBox="0 0 300 80"
        aria-hidden="true"
      >
        {/* outer ring — wider stroke, animates on hover */}
        <rect
          className="fancy-btn__ring fancy-btn__ring--outer"
          strokeWidth="6"
          stroke={outerColor}
          strokeLinecap="round"
          fill="none"
          x="4" y="4" width="292" height="72" rx="36"
        />
        {/* inner ring — thinner, slight delay */}
        <rect
          className="fancy-btn__ring fancy-btn__ring--inner"
          strokeWidth="3"
          stroke={innerColor}
          strokeLinecap="round"
          fill="none"
          x="4" y="4" width="292" height="72" rx="36"
        />
      </svg>
      <div className="fancy-btn__label">{label}</div>
    </div>
  )

  if (href) return <a href={href} style={{ display: 'inline-block' }}>{content}</a>
  return content
}
